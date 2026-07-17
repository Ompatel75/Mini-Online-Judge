import docker
from sqlalchemy.orm import Session
import tempfile
import os
import time
from app.db.models import Submission, Problem, TestCase, VerdictEnum

# Initialize docker client
try:
    client = docker.from_env()
except Exception as e:
    client = None
    print(f"Warning: Docker client could not be initialized. Judging will fail. Error: {e}")

def judge_submission(submission_id: int, db: Session):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        return
    
    submission.verdict = VerdictEnum.RUNNING
    db.commit()

    problem = db.query(Problem).filter(Problem.id == submission.problem_id).first()
    test_cases = db.query(TestCase).filter(TestCase.problem_id == problem.id).all()

    if not client:
        import subprocess
        # Fallback to local subprocess execution when Docker is unavailable (e.g. on Render)
        with tempfile.TemporaryDirectory() as temp_dir:
            code_path = os.path.join(temp_dir, "solution.cpp")
            with open(code_path, "w") as f:
                f.write(submission.code)

            # Compile the code locally using g++
            executable_name = "solution.exe" if os.name == "nt" else "solution"
            executable_path = os.path.join(temp_dir, executable_name)
            compile_cmd = ["g++", "-O2", "solution.cpp", "-o", executable_name]

            try:
                res = subprocess.run(
                    compile_cmd,
                    cwd=temp_dir,
                    capture_output=True,
                    timeout=60
                )
                if res.returncode != 0:
                    submission.verdict = VerdictEnum.CE
                    db.commit()
                    return
            except Exception as e:
                # If g++ is not installed or compiler fails to invoke
                print(f"Compilation fallback failed: {e}")
                submission.verdict = VerdictEnum.CE
                db.commit()
                return

            max_time_used = 0.0
            for tc in test_cases:
                input_path = os.path.join(temp_dir, "input.txt")
                output_path = os.path.join(temp_dir, "output.txt")

                with open(input_path, "w") as f:
                    f.write(tc.input_data)

                start_time = time.time()
                try:
                    with open(input_path, "r") as infile, open(output_path, "w") as outfile:
                        res = subprocess.run(
                            [executable_path],
                            stdin=infile,
                            stdout=outfile,
                            stderr=subprocess.PIPE,
                            timeout=problem.time_limit,
                            cwd=temp_dir
                        )
                    exec_time = time.time() - start_time
                    max_time_used = max(max_time_used, exec_time)

                    if res.returncode != 0:
                        submission.verdict = VerdictEnum.RE
                        db.commit()
                        return
                except subprocess.TimeoutExpired:
                    submission.verdict = VerdictEnum.TLE
                    db.commit()
                    return
                except Exception:
                    submission.verdict = VerdictEnum.RE
                    db.commit()
                    return

                # Compare outputs
                if os.path.exists(output_path):
                    with open(output_path, "r") as f:
                        user_output = f.read().strip()
                else:
                    user_output = ""

                expected_output = tc.expected_output.strip()
                if user_output != expected_output:
                    submission.verdict = VerdictEnum.WA
                    submission.execution_time = max_time_used
                    db.commit()
                    return

            submission.verdict = VerdictEnum.AC
            submission.execution_time = max_time_used
            db.commit()
            return


    with tempfile.TemporaryDirectory() as temp_dir:
        code_path = os.path.join(temp_dir, "solution.cpp")
        with open(code_path, "w") as f:
            f.write(submission.code)

        compile_cmd = "g++ -O2 solution.cpp -o solution"
        try:
            client.containers.run(
                "gcc:latest",
                command=compile_cmd,
                volumes={temp_dir: {'bind': '/usr/src/app', 'mode': 'rw'}},
                working_dir="/usr/src/app",
                remove=True
            )
        except docker.errors.ContainerError as e:
            submission.verdict = VerdictEnum.CE
            db.commit()
            return
        except Exception as e:
            submission.verdict = VerdictEnum.RE
            db.commit()
            return

        max_time_used = 0.0
        
        for tc in test_cases:
            input_path = os.path.join(temp_dir, "input.txt")
            output_path = os.path.join(temp_dir, "output.txt")
            
            with open(input_path, "w") as f:
                f.write(tc.input_data)
            
            # Using timeout command to enforce time limit
            run_cmd = f"bash -c 'timeout {problem.time_limit}s ./solution < input.txt > output.txt'"
            
            start_time = time.time()
            try:
                # Memory limit in bytes
                mem_limit_bytes = problem.memory_limit * 1024 * 1024
                client.containers.run(
                    "gcc:latest",
                    command=run_cmd,
                    volumes={temp_dir: {'bind': '/usr/src/app', 'mode': 'rw'}},
                    working_dir="/usr/src/app",
                    mem_limit=mem_limit_bytes,
                    memswap_limit=mem_limit_bytes, # Disable swap
                    network_disabled=True, # Security: prevent network access
                    remove=True
                )
            except docker.errors.ContainerError as e:
                # ContainerError usually means non-zero exit code (e.g. timeout returned 124, RE returned other)
                if e.exit_status == 124:
                    submission.verdict = VerdictEnum.TLE
                else:
                    submission.verdict = VerdictEnum.RE
                db.commit()
                return
            except Exception as e:
                submission.verdict = VerdictEnum.RE
                db.commit()
                return
            
            exec_time = time.time() - start_time
            max_time_used = max(max_time_used, exec_time)

            if os.path.exists(output_path):
                with open(output_path, "r") as f:
                    user_output = f.read().strip()
            else:
                user_output = ""
            
            expected_output = tc.expected_output.strip()
            
            if user_output != expected_output:
                submission.verdict = VerdictEnum.WA
                submission.execution_time = max_time_used
                db.commit()
                return

        submission.verdict = VerdictEnum.AC
        submission.execution_time = max_time_used
        db.commit()