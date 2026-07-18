# 🏛️ Mini Online Judge (MOJ)

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)](https://www.python.org/)

**Mini Online Judge (MOJ)** is a lightweight, secure, and robust online judge platform designed to compile and execute programming submissions. Built on **FastAPI** and containerized with **Docker**, MOJ provides safe sandboxing for code execution, custom limits (time & memory) on a per-problem basis, and a unified interactive dashboard.

---

## ✨ Key Features

- **🔒 Safe Sandboxing & Code Execution**:
  - Compiles and runs submitted C++ code inside isolated Docker containers using the `gcc:latest` image.
  - Strict resource constraints: enforces memory limits (in MB) and execution timeouts.
  - Network access is completely disabled inside the container to prevent security vulnerabilities.
- **⚡ Asynchronous Judging**:
  - Uses FastAPI's `BackgroundTasks` to judge code asynchronously, ensuring client responses are immediate while judging runs in the background.
- **📂 Problem & Test Case Management**:
  - Full CRUD operations for problems.
  - Interactive test case management (support for standard and hidden test cases).
  - Customizable time limits (seconds) and memory limits (MB) per problem.
- **👤 User Authentication**:
  - JWT token-based authentication (OAuth2 Password Bearer flow).
  - Role-based permissions (Admins can manage problems and test cases; users can submit code).
- **🖥️ Built-in SPA Frontend Dashboard**:
  - Serves an embedded Single Page Application (SPA) frontend directly through FastAPI's static directories.

---

## 🛠️ Tech Stack

- **Backend Framework**: [FastAPI](https://fastapi.tiangolo.com/)
- **Database ORM**: [SQLAlchemy](https://www.sqlalchemy.org/)
- **Database Engine**: [PostgreSQL](https://www.postgresql.org/)
- **Sandboxing**: [Docker Engine (via Docker SDK for Python)](https://docker-py.readthedocs.io/)
- **Authentication**: JWT (JSON Web Tokens), Cryptography (`python-jose`, `passlib[bcrypt]`)
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (Single Page Architecture)

---

## 📁 Project Structure

```text
moj-backend/
├── app/
│   ├── api/
│   │   ├── dependencies.py    # Database session and auth dependency injection
│   │   └── endpoints/         # Router endpoints (users, problems, submissions)
│   ├── core/
│   │   ├── config.py          # Pydantic settings loading from .env
│   │   └── security.py        # Hashing and JWT token logic
│   ├── db/
│   │   ├── database.py        # SQLAlchemy configuration
│   │   └── models.py          # DB schemas (User, Problem, TestCase, Submission)
│   ├── schemas/               # Pydantic schemas for request validation & serialization
│   ├── services/
│   │   └── judge.py           # Docker-based compiling, execution & judging engine
│   └── main.py                # FastAPI app initialization, middleware & static mounts
├── static/                    # Frontend client files (index.html, style.css, script.js)
├── .env.example               # Template environment configuration
├── requirements.txt           # Project python dependencies
└── README.md                  # Project documentation
```

---

## 🔗 Live Demo

You can view the live deployed application here:
👉 **[Mini Online Judge Live App](https://judgely.onrender.com)**

---

## 🔒 Sandboxing Architecture

The core evaluation logic in [judge.py](file:///c:/Users/ommal/OneDrive/Desktop/intership%20project/moj-backend/app/services/judge.py) supports two execution modes depending on host environment configuration:

### 1. Secure Containerized Mode (Default with Docker)
If Docker daemon is running on the host system:
* **Isolation**: Mounting a temporary directory into a clean, isolated container using the `gcc:latest` image.
* **Compilation**: Code is compiled via `g++ -O2 solution.cpp -o solution` inside the container.
* **Execution Limits**:
   - **Time Limit**: Enforced using bash `timeout` tool inside the container.
   - **Memory Limit**: Docker memory and swap constraint configurations are applied to limit RAM footprint.
* **Networking**: Disabled (`network_disabled=True`) to prevent malicious network usage.

### 2. Local Compiler Fallback Mode (Docker-less / Serverless hosting)
If Docker is not running or available (such as on Render free hosting):
* **Compilation & Execution**: Automatically compiles using the host's `g++` compiler and executes solution binaries locally via Python's standard `subprocess` module.
* **Resource Limits**: Uses compilation timeouts (60 seconds) and runtime process limits to guard against infinite loops and resource consumption.

### Verdict Flow
Submissions transition from `PENDING` -> `RUNNING` -> final verdict.

| Verdict | Short Description |
| :--- | :--- |
| **AC** | Accepted (Passes all test cases) |
| **WA** | Wrong Answer (User output does not match expected output) |
| **TLE** | Time Limit Exceeded (Execution exceeded problem time limit) |
| **RE** | Runtime Error (Segmentation fault, non-zero return code, out-of-memory) |
| **CE** | Compilation Error (Failed to compile the C++ source code) |

---

## 🛣️ API Endpoints Summary

### Authentication (`/api/users`)
- `POST /register`: Register a new user
- `POST /login`: Log in and retrieve JWT Bearer token
- `GET /me`: Get details of current authenticated user

### Problems (`/api/problems`)
- `GET /`: List all programming problems
- `POST /`: Create a new problem *(Admin only)*
- `GET /{problem_id}`: Get details of a single problem
- `POST /{problem_id}/testcases`: Add a new test case to a problem *(Admin only)*
- `DELETE /{problem_id}`: Delete a problem and its associated testcases *(Admin only)*

### Submissions (`/api/submissions`)
- `POST /`: Submit solution code for evaluation *(C++ only)*
- `GET /`: View all submissions
- `GET /me/status`: Fetch status summary of the user's submissions
- `GET /{submission_id}`: Retrieve details of a specific submission

