INSERT INTO "Role" ("id","code","name")
VALUES ('role_admin', 'ADMIN', 'Admin')
ON CONFLICT ("code") DO NOTHING;
