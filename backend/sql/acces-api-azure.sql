-- Autorise l'identité managée de l'API (créée par Terraform) à utiliser db-naissances.
-- À exécuter UNE fois, connecté à la base db-naissances en tant qu'administrateur Entra ID
-- (portail Azure > db-naissances > Éditeur de requête, ou SSMS « Microsoft Entra MFA »).
-- Aucun mot de passe : Azure SQL reconnaît l'identité « id-naissances-api » directement.

CREATE USER [id-naissances-api] FROM EXTERNAL PROVIDER;

ALTER ROLE db_datareader ADD MEMBER [id-naissances-api];  -- lire
ALTER ROLE db_datawriter ADD MEMBER [id-naissances-api];  -- écrire
ALTER ROLE db_ddladmin   ADD MEMBER [id-naissances-api];  -- appliquer les migrations EF au démarrage

-- NEXT VALUE FOR etatcivil.NumeroActeSequence exige le droit UPDATE sur la séquence.
GRANT UPDATE ON SCHEMA::etatcivil TO [id-naissances-api];
