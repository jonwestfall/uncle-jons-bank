<img src="frontend/public/unclejon.jpg" width="200" height="400">

# 💰 Uncle Jon's Bank

**Uncle Jon’s Bank** is a web-based financial education platform for kids, designed to simulate real-world money management in a safe, gamified environment. Parents act as the bank tellers and regulators, while kids build budgeting, saving, and delayed gratification habits.

---

## 🎯 Purpose

The goal is to teach kids about money through experience — without handing over actual bank accounts. Children get balances, interest, and basic financial products like CDs — while parents control transactions, set savings goals, and approve (or deny) withdrawals.

---

## 🧩 Core Features (MVP)

### 👨‍👩‍👧‍👦 Accounts & Access
- Multiple parent/guardian accounts per child, each with permission levels, making it possible to have:
  - **Viewer**: can see activity
  - **Depositor**: can add funds
  - **Approver**: can approve withdrawals
- Children have their own logins with a simplified UI through a secret code.
- Parents can generate one-time share codes to link additional guardians with custom permissions.

### 💸 Banking & Ledger
- One main balance per child
- Ability to accept offers on Certificates of Deposit (CDs) given by parents.
- Daily **compound interest**, with optional **bonus tiers** or promotions (Parents can change interest rates at any time)
- Full ledger of transactions: amount, memo, date, creator, type, promo ID (optional)
- Monetary amounts display a configurable currency symbol (default `$`).

### 📆 Recurring Charges, Fees & Promotions
- **Recurring charges** let parents schedule automatic deductions for regular expenses, like a monthly cell phone plan or an online game subscription, and now support recurring **credits** for direct deposits.
- Configure site-wide **service fees** or **overdraft penalties** to teach kids about the cost of banking.
- Run **promotions** that match deposits, waive fees, or boost interest rates to encourage saving and responsible spending.

### 💰 Certificate Deposits
Parents can offer time-locked certificates with a custom term and interest rate.
Children can review these offers and choose to accept or reject them. Accepting
debits the CD amount from the child’s balance and locks it until maturity. When
the term ends the principal plus interest is automatically deposited. Admins may
force a redemption early via `POST /cds/{cd_id}/redeem`; children can redeem
early themselves using `POST /cds/{cd_id}/redeem-early`. Early redemptions return
the principal and charge a 10% penalty. The `/tests/cd-issue` and
`/tests/cd-redeem` endpoints help generate and redeem CDs for integration tests.

### 🏦 Loans
Children can request loans that parents approve or deny. Approved loans disburse
funds into the child's balance, accrue daily interest, and track payments. Parents
can adjust interest rates, record payments, or close loans early.

### 🎟️ Coupons & Rewards
- Parents can generate printable coupons that deposit a set amount when redeemed.
- Coupons support optional expiration dates, usage limits, and child or system-wide scopes.
- Shareable links and QR codes make it easy for kids to claim rewards through the app.
### 🔐 Permissions & Controls
- Withdrawals are **requested** by the child, and **approved/denied** by guardians
- Accounts can be **frozen**.
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
- `Coupon`: Redeemable reward code
- `CouponRedemption`: Record of a coupon claim
- `Settings`: Site-wide configuration such as site name and URL
- `ChildUserLink`: Associates guardians and children (many-to-many)
- `Loan`: Parent-approved loans for children
- `LoanTransaction`: Payment and interest ledger for loans
- `ShareCode`: One-time code to link additional guardians

### 📡 API Endpoints (sample MVP endpoints)
- `POST /register`: Create parent account
- `POST /token`: Log in and get JWT
- `POST /children`: Add a child account (linked to current user)
- `GET /children`: List children linked to user
- `POST /children/{child_id}/sharecode`: Generate a one-time share code
- `POST /children/sharecode/{code}`: Redeem a share code to link a child
- `POST /transactions`: Add a deposit, withdrawal request, etc.
- `POST /withdrawals/{id}/approve`: Approve pending withdrawal
- `POST /withdrawals/{id}/deny`: Deny request with reason
- `POST /loans`: Child requests a loan
- `POST /loans/{id}/approve`: Parent approves and sets terms
- `POST /loans/{id}/payment`: Record a loan payment
- `POST /coupons`: Create a coupon for a child or group of children
- `GET /coupons`: List coupons created by the current user
- `POST /coupons/redeem`: Child redeems a coupon code
- `GET /settings`: Retrieve site-wide settings
- `PUT /settings`: Update site-wide settings (admin only)

---

## 🧪 Project Status

✅ Up and running with:
- Dockerized FastAPI backend
- SQLModel and Alembic support
- User/child creation
- Authentication & JWT token issuing
- Role-based permissions across endpoints
- Ledger transactions with daily interest accrual
- One-time share codes to link additional guardians
- Loan management with interest accrual and payments
- Withdrawal request & approval workflow
- Admin panel for managing users, children and transactions
- React frontend with dark mode and custom logo
- Nginx config serving the single page app
- Coupon creation and redemption with optional QR codes
- Admin-editable site settings including site name, URL, currency, and fees

🛠️ In development:
- Bucket-based budgeting support
- Notification system for denied withdrawals
- Additional automated tests

---

## 🚀 Getting Started

### Prerequisites
- Docker + Docker Compose (If you're new to the Docker ecosystem, download [https://www.docker.com/products/docker-desktop/](Docker Desktop) for your platform to get up and running.
- GitHub account (for cloning and pushing; alternatively you could just download this repository as a ZIP file, and unzip it to a directory of your choosing).

### Clone the Repo

```bash
git clone https://github.com/jonwestfall/uncle-jons-bank.git
cd uncle-jons-bank
```

### Start the App

```bash
docker compose up --build
```

### Run the App in the background
If you want this to stay up and running all the time, run the following:

```bash
docker compose up -d
```
Visit [http://localhost](http://localhost) for the frontend. *On the first load of the page, since there are no users, it will prompt you to create a super admin account*.

FastAPI's interactive docs are available at [http://localhost/api/docs](http://localhost/api/docs).

**The eaiest way to get data to play with is to use the API's interactive docs and run the /tests/run test with Persist = True.** This will create admin@example.com / adminpass as well as 2 example parents and 4 example children. You can then login as admin@example.com and update things as you like in the Admin tab.

## Admin Login

Admin users sign in using the regular parent login form with their email address
and password. Once logged in, visiting `/admin` will attempt to load the admin
interface. The React app checks your role by calling the `/users/me` endpoint in
`frontend/src/App.tsx`; if it returns an account with the `admin` role, the
admin panel is displayed.

Admins can configure site-wide settings—like the site name, base URL for shareable links, currency symbol, interest rates, and fees—through the admin panel.

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

## Bringing up backend / frontend separately

If you want to make changes but not recompile the entire docker container, you can use the following commands to bring up the backend, and then the frontend separately

```bash
cd backend
pip install -r requirements.txt    # only first time
uvicorn app.main:app --reload
cd ..
cd frontend
npm install                        # only first time
VITE_API_URL=http://localhost:8000 npm run dev
```

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

Uncle Jon’s Bank is more than a toy. It’s a tool to **build good money habits** before real money is at stake. Kids learn by **doing**, with structure, love, and maybe a penalty APR or two when needed. And unlike commercial products, it teaches to **save** not to **spend**.

---

## 🧑‍💻 Author

Built and maintained by **Jon Westfall** ([@jonwestfall](https://github.com/jonwestfall)) and future contributors.
