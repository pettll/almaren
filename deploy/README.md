# Deploying Almaren (Oracle Cloud Always Free)

This deploys Almaren to a single Oracle Cloud "Always Free" Ampere A1
instance with Caddy handling automatic HTTPS (via a free
[sslip.io](https://sslip.io) hostname, so no domain purchase is required).

Cost: $0/month as long as the instance stays within Always Free limits
(2 OCPU / 12GB RAM total, 200GB storage) — see the repo's project
history/discussion for the tradeoffs of this plan versus alternatives.

## 1. Create the Oracle Cloud account

Only you can do this step — it needs your identity and a card for
verification (you are not charged unless you later choose to upgrade the
account; see [oracle.com/cloud/free](https://www.oracle.com/cloud/free/)).

1. Sign up at [oracle.com/cloud/free](https://www.oracle.com/cloud/free/).
2. Once in the console, go to **Compute > Instances > Create Instance**.

## 2. Create the instance

- **Name**: `almaren`
- **Image**: Canonical Ubuntu (latest LTS)
- **Shape**: `VM.Standard.A1.Flex` — set 2 OCPU / 12GB memory (the full
  Always Free Ampere allotment)
- **Networking**: use the default VCN/subnet, "Assign a public IPv4
  address" checked
- **Add SSH keys**: paste the contents of `~/.ssh/almaren-oracle.pub`
  (generated locally — see the project's deployment conversation, or
  generate your own with `ssh-keygen -t ed25519 -f ~/.ssh/almaren-oracle`)
- **Show advanced options > Management > cloud-init script**: paste the
  contents of [`cloud-init.yaml`](./cloud-init.yaml) from this repo

Click **Create**. Boot takes a minute or two.

## 3. Open HTTP/HTTPS at the cloud firewall level

The OS-level firewall is handled by `cloud-init.yaml`, but the Oracle
Cloud **Security List** (or NSG) for your VCN's public subnet also needs
ingress rules, since it filters traffic before it reaches the instance:

**Networking > Virtual Cloud Networks > (your VCN) > Security Lists >
Default Security List > Add Ingress Rules**

Add two rules, both with source CIDR `0.0.0.0/0`:
- TCP, destination port `80`
- TCP, destination port `443`

(Port 22/SSH is open by default from the quick-create wizard.)

## 4. First deploy

SSH in using the key you generated, as the `ubuntu` user:

```
ssh -i ~/.ssh/almaren-oracle ubuntu@<PUBLIC_IP>
```

Then bootstrap and deploy in one line (the repo is public, no credentials
needed to clone it):

```
curl -fsSL https://raw.githubusercontent.com/pettll/almaren/main/deploy/deploy.sh | sudo bash
```

This clones the repo to `/opt/almaren`, installs dependencies, generates
a random `AUTH_SECRET`, applies database migrations, configures Caddy
for automatic HTTPS at `https://<ip-with-dashes>.sslip.io`, and starts
the `almaren` systemd service. The script prints the final URL when done.

## 5. (Optional) Enable GitHub login

By default only guest login works. To enable GitHub OAuth:

1. Create a GitHub OAuth App at
   `https://github.com/settings/developers`, with callback URL
   `https://<your-domain>/api/auth/callback/github`.
2. On the server, edit `/opt/almaren/.env` and fill in `GITHUB_ID` and
   `GITHUB_SECRET`.
3. `sudo systemctl restart almaren`

## Updating

Re-run the same bootstrap command (or `sudo bash /opt/almaren/deploy/deploy.sh`
if already on the box) — it's idempotent: pulls `main`, reinstalls
dependencies, re-applies any new migrations, and restarts the service.

## Operating

- Status: `sudo systemctl status almaren`
- Logs: `sudo journalctl -u almaren -f`
- Restart: `sudo systemctl restart almaren`

## Known limitations of this setup

- SQLite lives on the instance's own disk — it persists across restarts
  (unlike a free-tier PaaS with ephemeral storage), but there is no
  off-box backup. If the instance is deleted, the data goes with it.
- One instance, no redundancy — if it's abusively overloaded past the
  Always Free network/compute allotment, Oracle's stated behavior is to
  throttle/stop the excess, not bill you, but the app will go down until
  usage drops back under the cap.
