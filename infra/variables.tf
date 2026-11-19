variable "subscription_id" {
  description = "Abonnement Azure (az account show --query id -o tsv)."
  type        = string
}

variable "location" {
  description = "Région Azure."
  type        = string
  default     = "canadacentral"
}

variable "suffixe" {
  description = "Suffixe des noms qui doivent être uniques dans tout Azure (registre d'images)."
  type        = string
  default     = "doudou"
}

variable "sql_admin_login" {
  description = "Libellé de l'administrateur Entra ID du serveur SQL (tel qu'il existe aujourd'hui)."
  type        = string
}

variable "sql_admin_object_id" {
  description = "Object ID Entra de l'administrateur SQL (az ad signed-in-user show --query id -o tsv)."
  type        = string
}

variable "image_tag" {
  description = <<-EOT
    Version des images Docker à déployer (ex. « v1 »). Vide = les applications ne sont pas encore créées :
    le 1er « terraform apply » prépare le registre, puis on y pousse les images, puis on renseigne cette valeur.
  EOT
  type        = string
  default     = ""
}

variable "domaine_personnalise" {
  description = "Nom de domaine du site (enregistrements CNAME + TXT chez GoDaddy)."
  type        = string
  default     = "naissance.anmbo.ca"
}
