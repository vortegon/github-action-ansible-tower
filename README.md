# Run playbook on Ansible Tower
Github action that allows you to run a playbook on ansible tower.

## Usage
```yaml
uses: vortegon/github-action-ansible-tower@v1
with:
  ansible-tower-user: ${{ secrets.ansibleUser }}
  ansible-tower-pass: ${{ secrets.ansiblePass }}
  ansible-tower-url: ${{ secrets.ansibleUrl }}
  template-id: "1254"
  additional-vars: |
  {
      "var_azure_rm_subid": "${{ secrets.azureSubscription }}",
      "AZURE_RM_CLIENTID": "${{ secrets.azureClientId }}",
      "AZURE_RM_SECRET": "${{ secrets.azureClientSecret }}",
      "var_environment": "Development",
      "var_ctpService": "Co-Dev",
      "var_owner": "john.doe@test.com",
      "var_deploymentId": "TCDTCX",
      "var_chargeCode": "32405098",
      "var_location": "eastus",
      "var_productApp": "INT"
  }
``` 
