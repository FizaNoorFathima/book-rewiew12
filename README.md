# Bookmarked

A small personal book library with a FastAPI + PostgreSQL backend and a React frontend.

## 1. Create the database

In PostgreSQL, create a database named `Sample_Project_3`:

```sql
CREATE DATABASE "Sample_Project_3";
```

The backend uses:

- Host: `localhost`
- Port: `5432`
- User: `postgres`
- Password: `12345`
- Database: `Sample_Project_3`

If your PostgreSQL username is different, copy `backend/.env.example` to `backend/.env` and update `DATABASE_URL`.

## 2. Start the API

From the project folder:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`. Tables are created automatically when the API starts.

## 3. Start the website

Open another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the URL Vite prints, normally `http://localhost:5173`.

## Deploy with Render

Push this repository to GitHub, then in Render choose **New → Blueprint** and
select the repository. Render reads the root `render.yaml` and creates the
frontend, API, and PostgreSQL database. Review the resources and click **Apply**.
The frontend and API hostnames and the database connection are wired through
Blueprint environment variables.

## Features

- Registration and login with unique email addresses.
- Passwords must contain at least 8 characters, including a letter and a number.
- Each account sees only its own books.
- Add books with name, author, genre, 1–5 star rating, and read/to-read status.
- Automatically find book covers through Open Library when adding a title.
- Search by book name or genre as you type.
- Filter the shelf by all books, books to read, or books already read.
- Delete books from the shelf.
