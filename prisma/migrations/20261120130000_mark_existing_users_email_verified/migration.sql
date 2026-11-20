-- Better Auth only links an Authentik login to an existing user if that user's
-- email_verified is true (account linking's "requireLocalEmailVerified" gate,
-- which Better Auth is about to make unconditional). Users created by the old
-- password signup have false, so their first Authentik login failed with
-- account_not_linked.
--
-- Marking them verified is safe here: password login is gone, so nobody can
-- sign in with an unverified local credential, and Authentik only lets someone
-- in after they proved they own the mailbox. New users get true from Authentik.
UPDATE "users" SET "email_verified" = true WHERE "email_verified" = false;
