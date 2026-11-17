# IRON 40

Cannabis delivery platform for licensed operators. Three separate apps share one locked-down database:

| App | Folder | Who uses it |
| --- | --- | --- |
| Storefront | `apps/customer` | Customers: menu, ID verification, checkout, tracking, receipts |
| Driver | `apps/driver` | Drivers: go online, receive dispatched orders, door-side ID check |
| Ops | `apps/ops` | Owners and dispatchers: live board, ID review, stock, drivers, QR campaigns |

Each app is its own Vercel project on its own domain, with its own session cookie. A customer login can't open the
driver or ops app, and the database rejects any call that doesn't match the caller's role.

See `docs/SETUP.md` to run it and `docs/SECURITY_AUDIT.md` for the security audit.
