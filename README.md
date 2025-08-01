<img src="frontend/public/unclejon.jpg" width="200" height="400">

# 💰 Uncle Jon's Bank

**Uncle Jon’s Bank** is a web-based financial education platform for kids, designed to simulate real-world money management in a safe, gamified environment. Parents act as the bank tellers and regulators, while kids build budgeting, saving, and delayed gratification habits.

---

## 🎯 Purpose

The goal is to teach kids about money through experience — without handing over actual bank accounts. Children get balances, budgets, and interest — while parents control transactions, set savings goals, and approve (or deny) withdrawals.

---

## 🧩 Core Features (MVP)

### 👨‍👩‍👧‍👦 Accounts & Access
- Multiple parent/guardian accounts per child, each with roles:
  - **Viewer**: can see activity
  - **Depositor**: can add funds
  - **Approver**: can approve withdrawals
- Children have their own logins with a simplified UI

### 💸 Banking & Ledger
- One main balance per child
- Optional **buckets** (spending, saving, giving)
- Optional **locked savings** (e.g., “CD-style” accounts)
- Daily **compound interest**, with optional **bonus tiers** or promotions
- Full ledger of transactions: amount, memo, date, creator, type, promo ID (optional)

### 🔐 Permissions & Controls
- Withdrawals are **requested** by the child, and **approved/denied** by guardians
- Accounts can be **frozen** or have **limits**
- Penalty interest can apply to negative balances

### 🧠 Educational & Fun
- **Gamified** goals, achievements, and badges
- Personalized messages from parents
- Exportable account summary (PDF/image)
- Educational tools integrated into child UI

---

## 🔧 Backend Design

Built with **FastAPI** and **SQLModel**, the backend provides:

### 🔐 Auth & Security
- JWT-based authentication
- Role-based access control
- Secure parent/child linking

### 📦 Models
- `User`: Parent/guardian
- `Child`: Bank account owner
- `Transaction`: Deposit, withdrawal, interest, bonus, etc.
- `Bucket`: Optional budgeting areas
- `LedgerEntry`: Internal transaction record
- `AccessCode`: For child login
- `AccountSettings`: Interest rates, lock flags, etc.
- `ChildUserLink`: Associates guardians and children (many-to-many)

### 📡 API Endpoints (sample MVP endpoints)
- `POST /register`: Create parent account
- `POST /token`: Log in and get JWT
- `POST /children`: Add a child account (linked to current user)
- `GET /children`: List children linked to user
- `POST /transactions`: Add a deposit, withdrawal request, etc.
- `POST /withdrawals/{id}/approve`: Approve pending withdrawal
- `POST /withdrawals/{id}/deny`: Deny request with reason

---

## 🧪 Project Status

✅ Up and running with:
- Dockerized FastAPI backend
- SQLModel and Alembic support
- User/child creation
- Authentication & JWT token issuing
- Role-based permissions across endpoints
- Ledger transactions with daily interest accrual
- Withdrawal request & approval workflow
- Admin panel for managing users, children and transactions
- React frontend with dark mode and custom logo
- Nginx config serving the single page app

🛠️ In development:
- Bucket-based budgeting support
- Notification system for denied withdrawals
- Additional automated tests

---

## 🚀 Getting Started

### Prerequisites
- Docker + Docker Compose
- GitHub account (for cloning and pushing)

### Clone the Repo

```bash
git clone https://github.com/YOUR_USERNAME/uncles-bank.git
cd uncles-bank
```

### Start the App

```bash
docker compose up --build
```

FastAPI will be served at: [http://localhost:8000/docs](http://localhost:8000/docs)
The React frontend will be available at [http://localhost:3000](http://localhost:3000)

### Migrate DB

If you change models:

```bash
docker compose exec backend alembic revision --autogenerate -m "Your message"
docker compose exec backend alembic upgrade head
```

## Admin Login

Admin users sign in using the regular parent login form with their email address
and password. Once logged in, visiting `/admin` will attempt to load the admin
interface. The React app checks your role by calling the `/users/me` endpoint in
`frontend/src/App.tsx`; if it returns an account with the `admin` role, the
admin panel is displayed.

## 🧪 Testing

The repository includes an integration test suite that provisions example
accounts and verifies API functionality. After installing the Python
dependencies with `pip install -r backend/requirements.txt`, you can run the
tests in two ways:

1. **Directly via Python**

   ```bash
   cd backend
   python -m app.tests.api_tests
   ```

   This starts an in-memory database, creates two parents with two children each
   and several sample transactions, and reports the results.

2. **Through the running API**

   Start the backend with `uvicorn app.main:app` (or `docker compose up`) and
   POST to `/tests/run`:

   ```bash
   curl -X POST http://localhost:8000/tests/run
   ```

   The endpoint will initialize the sample users and transactions and return a
   JSON summary of the tests.

   Add the query parameter `persist=true` to store the sample accounts in the
   running database and receive their login credentials for manual testing:

   ```bash
   curl -X POST "http://localhost:8000/tests/run?persist=true"
   ```

---

## 🔐 Environment Variables

Create a `.env` file inside the `backend` directory with at least:

```env
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

These are used for JWT authentication.

---

## 🧠 Future Roadmap

### 💡 Short-Term
- Bucket-based budgeting system
- Notification system for denied withdrawals
- UI polish and child-friendly enhancements
- Automated testing suite

### 🧠 Long-Term
- Mobile-first PWA
- Export/shareable savings goals
- QR-code or NFC for chore redemption
- Educational module library
- Stripe integration for optional real-world funds (opt-in)

---

## 👨‍👧 Philosophy

Uncle Jon’s Bank is more than a toy. It’s a tool to **build good money habits** before real money is at stake. Kids learn by **doing**, with structure, love, and maybe a penalty APR or two when needed.

---

## 🧑‍💻 Author

Built and maintained by **Jon Westfall** ([@jonwestfall](https://github.com/jonwestfall)) and future contributors.
