locals {
  tags = {
    application = "registre-naissances"
    gere-par    = "terraform"
  }

  # Les applications ne sont créées qu'une fois les images poussées dans le registre.
  deployer_applications = var.image_tag != ""
}

data "azurerm_client_config" "courant" {}

# ─────────────────────────── Existant (importé) ───────────────────────────

resource "azurerm_resource_group" "rg" {
  name     = "rg-naissances"
  location = var.location
  tags     = local.tags
}

resource "azurerm_mssql_server" "sql" {
  name                          = "sql-naissances-doudou"
  resource_group_name           = azurerm_resource_group.rg.name
  location                      = azurerm_resource_group.rg.location
  version                       = "12.0"
  minimum_tls_version           = "1.2"
  public_network_access_enabled = true
  tags                          = local.tags

  # Connexion Entra ID UNIQUEMENT : aucun mot de passe SQL n'existe.
  azuread_administrator {
    login_username              = var.sql_admin_login
    object_id                   = var.sql_admin_object_id
    tenant_id                   = data.azurerm_client_config.courant.tenant_id
    azuread_authentication_only = true
  }

  lifecycle {
    prevent_destroy = true
    # Compte « CloudSA… » généré par Azure, inutilisable (auth Entra uniquement).
    ignore_changes = [administrator_login]
  }
}

resource "azurerm_mssql_database" "db" {
  name                 = "db-naissances"
  server_id            = azurerm_mssql_server.sql.id
  sku_name             = "S0"
  collation            = "SQL_Latin1_General_CP1_CI_AS"
  max_size_gb          = 250
  zone_redundant       = false
  storage_account_type = "Geo"
  tags                 = local.tags

  lifecycle {
    prevent_destroy = true # protège les naissances enregistrées
  }
}

# Les conteneurs Azure n'ont pas d'IP fixe : on autorise les services Azure.
# Sans risque ici car le serveur n'accepte QUE des identités Entra ID (pas de mot de passe).
resource "azurerm_mssql_firewall_rule" "services_azure" {
  name             = "AllowAllWindowsAzureIps"
  server_id        = azurerm_mssql_server.sql.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# ─────────────────────────── Socle des conteneurs ───────────────────────────

resource "azurerm_log_analytics_workspace" "logs" {
  name                = "log-naissances"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.tags
}

resource "azurerm_container_app_environment" "env" {
  name                       = "cae-naissances"
  resource_group_name        = azurerm_resource_group.rg.name
  location                   = azurerm_resource_group.rg.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id
  tags                       = local.tags

  # Profil par défaut ajouté par Azure : facturation à l'usage (s'éteint sans trafic).
  workload_profile {
    name                  = "Consumption"
    workload_profile_type = "Consumption"
  }
}

resource "azurerm_container_registry" "acr" {
  name                = "acrnaissances${var.suffixe}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = "Basic"
  admin_enabled       = false # pas de mot de passe : les applications tirent les images par identité
  tags                = local.tags
}

# ─────────────────────────── Identités (sans mot de passe) ───────────────────────────

# L'API : lit les images du registre + se connecte à Azure SQL.
resource "azurerm_user_assigned_identity" "api" {
  name                = "id-naissances-api"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  tags                = local.tags
}

# Le site : lit seulement les images du registre (aucun accès à la base).
resource "azurerm_user_assigned_identity" "web" {
  name                = "id-naissances-web"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  tags                = local.tags
}

resource "azurerm_role_assignment" "acr_pull" {
  for_each = {
    api = azurerm_user_assigned_identity.api.principal_id
    web = azurerm_user_assigned_identity.web.principal_id
  }

  scope                = azurerm_container_registry.acr.id
  role_definition_name = "AcrPull"
  principal_id         = each.value
  principal_type       = "ServicePrincipal"
}

# ─────────────────────────── Applications ───────────────────────────

resource "azurerm_container_app" "api" {
  count = local.deployer_applications ? 1 : 0

  name                         = "ca-naissances-api"
  resource_group_name          = azurerm_resource_group.rg.name
  container_app_environment_id = azurerm_container_app_environment.env.id
  revision_mode                = "Single"
  workload_profile_name        = "Consumption"
  tags                         = local.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.api.id]
  }

  registry {
    server   = azurerm_container_registry.acr.login_server
    identity = azurerm_user_assigned_identity.api.id
  }

  # INTERNE : joignable seulement depuis le site (nginx), jamais depuis Internet.
  ingress {
    external_enabled = false
    target_port      = 8080
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 1 # toujours allumée : évite ~20 s de démarrage à froid (≈ 8-10 $ US/mois)
    max_replicas = 2

    container {
      name   = "api"
      image  = "${azurerm_container_registry.acr.login_server}/naissances-api:${var.image_tag}"
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "ConnectionStrings__Naissances"
        value = "Server=tcp:${azurerm_mssql_server.sql.fully_qualified_domain_name},1433;Database=${azurerm_mssql_database.db.name};Authentication=Active Directory Managed Identity;User Id=${azurerm_user_assigned_identity.api.client_id};Encrypt=True;TrustServerCertificate=False;Connection Timeout=60;"
      }
      env {
        name  = "Demarrage__AppliquerMigrations"
        value = "true"
      }

      liveness_probe {
        transport        = "HTTP"
        path             = "/health"
        port             = 8080
        initial_delay    = 10
        interval_seconds = 30
      }
    }
  }

  depends_on = [azurerm_role_assignment.acr_pull]
}

resource "azurerm_container_app" "web" {
  count = local.deployer_applications ? 1 : 0

  name                         = "ca-naissances-web"
  resource_group_name          = azurerm_resource_group.rg.name
  container_app_environment_id = azurerm_container_app_environment.env.id
  revision_mode                = "Single"
  workload_profile_name        = "Consumption"
  tags                         = local.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.web.id]
  }

  registry {
    server   = azurerm_container_registry.acr.login_server
    identity = azurerm_user_assigned_identity.web.id
  }

  # PUBLIC : c'est l'adresse que visitent les utilisateurs (puis naissance.anmbo.ca).
  ingress {
    external_enabled = true
    target_port      = 8080
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 0
    max_replicas = 2

    container {
      name   = "web"
      image  = "${azurerm_container_registry.acr.login_server}/naissances-web:${var.image_tag}"
      cpu    = 0.25
      memory = "0.5Gi"

      # nginx relaie /api vers l'adresse interne de l'API (HTTPS dans l'environnement).
      env {
        name  = "API_URL"
        value = "https://${azurerm_container_app.api[0].ingress[0].fqdn}"
      }
    }
  }

  depends_on = [azurerm_role_assignment.acr_pull]
}
