#!/usr/bin/env bash
# Lancé par la tâche AzureCLI@2 (addSpnToEnvironment: true) du pipeline.
#   terraform.sh plan  <image_tag>               → crée infra/tfplan
#   terraform.sh apply <image_tag> <fichier_plan> → applique EXACTEMENT le plan approuvé
set -euo pipefail

action=$1
image_tag=$2
plan=${3:-}

# Authentification Terraform par Workload Identity Federation : la tâche fournit
# un jeton OIDC de courte durée ($idToken). Aucun mot de passe ni secret.
export ARM_USE_OIDC=true
export ARM_OIDC_TOKEN="$idToken"
export ARM_CLIENT_ID="$servicePrincipalId"
export ARM_TENANT_ID="$tenantId"
export ARM_SUBSCRIPTION_ID=$(az account show --query id -o tsv)

# Variables Terraform lues dans Azure (rien à stocker dans le pipeline).
export TF_VAR_subscription_id="$ARM_SUBSCRIPTION_ID"
export TF_VAR_sql_admin_login=$(az sql server ad-admin list -g rg-naissances -s sql-naissances-doudou --query "[0].login" -o tsv)
export TF_VAR_sql_admin_object_id=$(az sql server ad-admin list -g rg-naissances -s sql-naissances-doudou --query "[0].sid" -o tsv)
export TF_VAR_image_tag="$image_tag"
export TF_IN_AUTOMATION=true

cd "$(dirname "$0")/../infra"
terraform init -input=false

case "$action" in
  plan)
    # -detailed-exitcode : 0 = aucun changement, 2 = changements, 1 = erreur.
    set +e
    terraform plan -input=false -out=tfplan -detailed-exitcode
    code=$?
    set -e
    [ "$code" -eq 1 ] && exit 1
    terraform show -no-color tfplan | tail -n 40
    ;;
  apply)
    terraform apply -input=false "$plan"
    terraform output
    ;;
  *)
    echo "Action inconnue : $action (plan | apply)" >&2
    exit 1
    ;;
esac
