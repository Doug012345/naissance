terraform {
  required_version = ">= 1.9"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }

  # État LOCAL pour l'instant (terraform.tfstate, ignoré par Git).
  # À l'étape CI/CD, il sera déplacé dans un compte de stockage Azure
  # pour que GitHub Actions et votre poste partagent le même état.
}

provider "azurerm" {
  subscription_id = var.subscription_id

  # Microsoft.App (Container Apps) n'est pas encore activé sur l'abonnement.
  resource_providers_to_register = ["Microsoft.App"]

  features {}
}
