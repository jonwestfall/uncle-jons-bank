# ACL constants and helpers

PERM_ADD_TRANSACTION = "add_transaction"
PERM_VIEW_TRANSACTIONS = "view_transactions"
PERM_DELETE_TRANSACTION = "delete_transaction"
PERM_EDIT_TRANSACTION = "edit_transaction"
PERM_DEPOSIT = "deposit"
PERM_DEBIT = "debit"
PERM_ADD_CHILD = "add_child"
PERM_REMOVE_CHILD = "remove_child"
PERM_FREEZE_CHILD = "freeze_child"

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
    ],
    "child": [PERM_VIEW_TRANSACTIONS],
}


def get_default_permissions_for_role(role: str) -> list[str]:
    return ROLE_DEFAULT_PERMISSIONS.get(role, [])
