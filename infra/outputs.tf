output "registre" {
  description = "Adresse du registre d'images (docker push)."
  value       = azurerm_container_registry.acr.login_server
}

output "identite_api" {
  description = "Nom de l'identité de l'API, à autoriser dans la base (sql/acces-api-azure.sql)."
  value       = azurerm_user_assigned_identity.api.name
}

output "site_adresse_azure" {
  description = "Adresse du site fournie par Azure (fonctionne avant le domaine personnalisé)."
  value       = local.deployer_applications ? "https://${azurerm_container_app.web[0].ingress[0].fqdn}" : "(pas encore déployé : renseignez image_tag)"
}

output "godaddy_cname" {
  description = "Enregistrement CNAME à créer chez GoDaddy."
  value = local.deployer_applications ? {
    type   = "CNAME"
    nom    = split(".", var.domaine_personnalise)[0]
    valeur = azurerm_container_app.web[0].ingress[0].fqdn
  } : null
}

output "godaddy_txt" {
  description = "Enregistrement TXT à créer chez GoDaddy (prouve que le domaine vous appartient)."
  value = local.deployer_applications ? {
    type = "TXT"
    nom  = "asuid.${split(".", var.domaine_personnalise)[0]}"
    # Marqué « sensible » par le fournisseur, mais il finit publiquement dans le DNS (TXT).
    valeur = nonsensitive(azurerm_container_app.web[0].custom_domain_verification_id)
  } : null
}
