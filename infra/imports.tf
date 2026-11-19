# Ressources créées AVANT Terraform (par scripts) : on les IMPORTE au lieu de les recréer.
# Au 1er « terraform plan », Terraform les lit dans Azure et les ajoute à son état.
# Les données de la base ne sont pas touchées.

import {
  to = azurerm_resource_group.rg
  id = "/subscriptions/${var.subscription_id}/resourceGroups/rg-naissances"
}

import {
  to = azurerm_mssql_server.sql
  id = "/subscriptions/${var.subscription_id}/resourceGroups/rg-naissances/providers/Microsoft.Sql/servers/sql-naissances-doudou"
}

import {
  to = azurerm_mssql_database.db
  id = "/subscriptions/${var.subscription_id}/resourceGroups/rg-naissances/providers/Microsoft.Sql/servers/sql-naissances-doudou/databases/db-naissances"
}
