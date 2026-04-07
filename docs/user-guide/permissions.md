# Permissions

Per-child parent access is controlled by permission strings in `backend/app/acl.py`.

## Core permissions

- `add_transaction`, `view_transactions`, `edit_transaction`, `delete_transaction`
- `deposit`, `debit`
- `add_child`, `remove_child`, `freeze_child`
- `add_recurring_charge`, `edit_recurring_charge`, `delete_recurring_charge`
- `offer_cd`, `offer_loan`, `manage_loan`
- `manage_withdrawals`
- `manage_child_settings`
- `send_message`

## Role defaults

- `admin`: full permission set.
- `parent`: full permission set by default.
- `child`: `view_transactions`.

## Link-level behavior

- Parent-child links can carry custom permission subsets.
- Link owners are treated as full-access for that child.
- Share codes can grant scoped permissions to additional guardians.
