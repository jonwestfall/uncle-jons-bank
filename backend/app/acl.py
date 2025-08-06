"""Access control list constants and helpers.

The API uses string permission names to authorize actions.  This module
defines all available permissions and maps default permissions for each
user role.  Having these values in one place makes it easy to audit and
update the security model.
"""

PERM_ADD_TRANSACTION = "add_transaction"
PERM_VIEW_TRANSACTIONS = "view_transactions"
PERM_DELETE_TRANSACTION = "delete_transaction"
PERM_EDIT_TRANSACTION = "edit_transaction"
PERM_DEPOSIT = "deposit"
PERM_DEBIT = "debit"
PERM_ADD_CHILD = "add_child"
PERM_REMOVE_CHILD = "remove_child"
PERM_FREEZE_CHILD = "freeze_child"
PERM_ADD_RECURRING = "add_recurring_charge"
PERM_EDIT_RECURRING = "edit_recurring_charge"
PERM_DELETE_RECURRING = "delete_recurring_charge"
PERM_OFFER_CD = "offer_cd"
PERM_OFFER_LOAN = "offer_loan"
PERM_MANAGE_LOAN = "manage_loan"
PERM_MANAGE_WITHDRAWALS = "manage_withdrawals"
PERM_MANAGE_CHILD_SETTINGS = "manage_child_settings"

ALL_PERMISSIONS = [
    PERM_ADD_TRANSACTION,
    PERM_VIEW_TRANSACTIONS,
    PERM_DELETE_TRANSACTION,
    PERM_EDIT_TRANSACTION,
    PERM_DEPOSIT,
    PERM_DEBIT,
    PERM_ADD_CHILD,
    PERM_REMOVE_CHILD,
    PERM_FREEZE_CHILD,
    PERM_ADD_RECURRING,
    PERM_EDIT_RECURRING,
    PERM_DELETE_RECURRING,
    PERM_OFFER_CD,
    PERM_OFFER_LOAN,
    PERM_MANAGE_LOAN,
    PERM_MANAGE_WITHDRAWALS,
    PERM_MANAGE_CHILD_SETTINGS,
]

ROLE_DEFAULT_PERMISSIONS = {
    "admin": ALL_PERMISSIONS,
    "parent": [
        PERM_ADD_TRANSACTION,
        PERM_VIEW_TRANSACTIONS,
        PERM_EDIT_TRANSACTION,
        PERM_DEPOSIT,
        PERM_DEBIT,
        PERM_ADD_CHILD,
        PERM_REMOVE_CHILD,
        PERM_FREEZE_CHILD,
        PERM_ADD_RECURRING,
        PERM_EDIT_RECURRING,
        PERM_DELETE_RECURRING,
        PERM_OFFER_CD,
        PERM_OFFER_LOAN,
        PERM_MANAGE_LOAN,
        PERM_MANAGE_WITHDRAWALS,
        PERM_MANAGE_CHILD_SETTINGS,
    ],
    "child": [PERM_VIEW_TRANSACTIONS],
}


def get_default_permissions_for_role(role: str) -> list[str]:
    return ROLE_DEFAULT_PERMISSIONS.get(role, [])
