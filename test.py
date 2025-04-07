import requests

def list_proxmox_vms():
    base_url = "https://proxmox.maximevery.fr"
    node_name = "proxmox"
    token_id = "root@pam!ProxmoxWebUI"
    token_secret = "193719c2-31a5-4d61-a77a-34efb4cfa46c"

    url = f"{base_url}/api2/json/nodes/{node_name}/qemu"
    headers = {
        "Authorization": f"PVEAPIToken={token_id}={token_secret}"
    }

    try:
        response = requests.get(url, headers=headers, verify=False)
        response.raise_for_status()
        vms = response.json()["data"]
        for vm in vms:
            print(f"{vm['vmid']} - {vm['name']} ({vm['status']})")
        return vms

    except requests.RequestException as e:
        print(f"Erreur lors de la récupération des VMs : {e}")
        return []

# Lancer la fonction
list_proxmox_vms()
