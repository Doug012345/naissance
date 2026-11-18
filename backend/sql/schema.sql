-- Script équivalent à la migration EF Core « Initiale » (pour lecture dans SSMS).
-- En pratique : dotnet ef migrations add Initiale (voir README) génère la même chose.
IF DB_ID('EtatCivil') IS NULL CREATE DATABASE EtatCivil;
GO
USE EtatCivil;
GO
DROP TABLE IF EXISTS etatcivil.Naissances;
DROP SEQUENCE IF EXISTS etatcivil.NumeroActeSequence;
IF SCHEMA_ID('etatcivil') IS NULL EXEC('CREATE SCHEMA etatcivil');
GO
CREATE SEQUENCE etatcivil.NumeroActeSequence AS bigint START WITH 1 INCREMENT BY 1;
GO
CREATE TABLE etatcivil.Naissances (
    Id                          uniqueidentifier NOT NULL CONSTRAINT PK_Naissances PRIMARY KEY,
    NumeroActe                  nvarchar(20)     NOT NULL,
    Enfant_Prenom               nvarchar(100)    NOT NULL,
    Enfant_Nom                  nvarchar(100)    NOT NULL,
    Sexe                        nvarchar(20)     NOT NULL,
    DateHeureNaissance          datetime2(0)     NOT NULL,
    Etablissement               nvarchar(200)    NOT NULL,
    Ville                       nvarchar(100)    NOT NULL,
    PoidsGrammes                int              NOT NULL,
    TailleCm                    decimal(4,1)     NOT NULL,
    Mere_Prenom                 nvarchar(100)    NOT NULL,
    Mere_Nom                    nvarchar(100)    NOT NULL,
    Mere_DateNaissance          date             NOT NULL,
    SecondParent_Prenom         nvarchar(100)    NULL,
    SecondParent_Nom            nvarchar(100)    NULL,
    SecondParent_DateNaissance  date             NULL,
    Statut                      nvarchar(20)     NOT NULL,
    MotifAnnulation             nvarchar(500)    NULL,
    DateEnregistrementUtc       datetime2(0)     NOT NULL,
    Version                     rowversion       NOT NULL
);
CREATE UNIQUE INDEX IX_Naissances_NumeroActe ON etatcivil.Naissances (NumeroActe);
CREATE INDEX IX_Naissances_Enfant_Nom       ON etatcivil.Naissances (Enfant_Nom);
CREATE INDEX IX_Naissances_DateHeure        ON etatcivil.Naissances (DateHeureNaissance);
GO
