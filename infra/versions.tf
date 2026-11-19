terraform {
  required_version = ">= 1.9"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }

  # État partagé entre votre poste et Azure Pipelines, dans un stockage Azure
  # (créé hors Terraform : rg-naissances-tfstate / stnaissancestfstate).
  #  - use_azuread_auth : accès par Entra ID (clés du compte de stockage désactivées) ;
  #  - verrou automatique (bail du blob) : deux « apply » ne peuvent pas tourner en même temps ;
  #  - versions + corbeille 14 jours activées sur le compte : un état abîmé se restaure.
  backend "azurerm" {
    resource_group_name  = "rg-naissances-tfstate"
    storage_account_name = "stnaissancestfstate"
    container_name       = "tfstate"
    key                  = "naissances.tfstate"
    use_azuread_auth     = true
  }
}

provider "azurerm" {
  subscription_id = var.subscription_id

  # Les fournisseurs Azure (dont Microsoft.App) sont déjà enregistrés sur l'abonnement.
  # « none » : Terraform n'y touche pas, ce qui permet au pipeline de n'avoir des droits
  # QUE sur rg-naissances (pas sur tout l'abonnement).
  resource_provider_registrations = "none"

  features {}
}
