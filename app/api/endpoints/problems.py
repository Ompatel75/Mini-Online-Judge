from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Any
from app.api.dependencies import get_db, get_current_admin_user
from app.db.models import Problem, TestCase
from app.schemas.problem import ProblemCreate, ProblemResponse, TestCaseCreate, TestCaseResponse

router = APIRouter()

@router.get("/", response_model=List[ProblemResponse])
def read_problems(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)) -> Any:
    problems = db.query(Problem).offset(skip).limit(limit).all()
    return problems

@router.post("/", response_model=ProblemResponse)
def create_problem(
    *,
    db: Session = Depends(get_db),
    problem_in: ProblemCreate,
    current_user = Depends(get_current_admin_user)
) -> Any:
    problem = Problem(**problem_in.model_dump())
    db.add(problem)
    db.commit()
    db.refresh(problem)
    return problem

@router.get("/{problem_id}", response_model=ProblemResponse)
def read_problem(problem_id: int, db: Session = Depends(get_db)) -> Any:
    problem = db.query(Problem).filter(Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    return problem

@router.post("/{problem_id}/testcases", response_model=TestCaseResponse)
def create_testcase_for_problem(
    problem_id: int,
    testcase_in: TestCaseCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
) -> Any:
    problem = db.query(Problem).filter(Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    
    testcase = TestCase(**testcase_in.model_dump(), problem_id=problem_id)
    db.add(testcase)
    db.commit()
    db.refresh(testcase)
    return testcase

@router.delete("/{problem_id}")
def delete_problem(
    problem_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
) -> Any:
    problem = db.query(Problem).filter(Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
        
    db.query(TestCase).filter(TestCase.problem_id == problem_id).delete()
    from app.db.models import Submission
    db.query(Submission).filter(Submission.problem_id == problem_id).delete()
    
    db.delete(problem)
    db.commit()
    return {"message": "Problem deleted successfully"}
