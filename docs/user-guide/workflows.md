# Workflows

## 1. Parent creates a child account

1. Parent logs in.
2. Parent creates child profile and access code.
3. Parent may share account access with another guardian via share code.

## 2. Child requests a withdrawal

1. Child creates withdrawal request with amount and memo.
2. Parent/admin reviews pending requests.
3. Request is approved, denied, or canceled.
4. Ledger reflects final state.

## 3. Parent offers a CD

1. Parent creates CD offer (`amount`, `interest_rate`, `term_days`).
2. Child accepts or rejects the offer.
3. If accepted, funds lock until maturity.
4. On maturity, principal plus interest is credited.

## 4. Loan lifecycle

1. Child requests loan.
2. Parent approves/denies (or child declines).
3. Approved loan disburses funds and accrues interest daily.
4. Parent records payments or closes loan early.

## 5. Chore lifecycle

1. Parent assigns chore or child proposes chore.
2. Child marks as complete.
3. Parent approves/rejects.
4. Approved chore credits account.
