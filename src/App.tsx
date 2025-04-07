import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/clerk-react";

// Define interfaces for type safety
interface Quota {
  ram: number;
  storage: number;
}

interface UserProfile {
  email: string;
  role: string;
}

interface Network {
  bridge: string;
  model: string;
}

interface Storage {
  size: number;
  storage: string;
}

interface VM {
  vmid: number;
  name: string;
  os: string;
  cores: number;
  ram: number;
  disk: number;
  networks: Network[];
  storages: Storage[];
  status: 'running' | 'stopped';
  owner: string;
}

// Type-safe object definitions
const DEFAULT_QUOTAS: Record<string, Quota> = {
  admin: { ram: 32768, storage: 250 },
  user: { ram: 30720, storage: 200 },
  invited: { ram: 2048, storage: 50 }
};

const USER_PROFILES: Record<string, UserProfile> = {
  admin: { email: "maxime.very@hesias.fr", role: "Administrateur" },
  user: { email: "romain.chatonnier@hesias.fr", role: "Développeur" },
  invited: { email: "Invité", role: "Utilisateur" }
};

function getOsIcon(os: string): string {
  const name = os.toLowerCase();
  if (name.includes("ubuntu")) return "https://companieslogo.com/img/orig/ubuntu-ace93e08.png";
  if (name.includes("debian")) return "https://companieslogo.com/img/orig/debian-7e44a05f.png";
  if (name.includes("centos")) return "https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/CentOS_color_logo.svg/2048px-CentOS_color_logo.svg.png";
  if (name.includes("windows")) {
    if (name.includes("xp")) return "https://e7.pngegg.com/pngimages/668/511/png-clipart-windows-xp-microsoft-windows-operating-system-windows-text-logo.png";
    if (name.includes("7")) return "https://w7.pngwing.com/pngs/567/690/png-transparent-windows-logo-windows-7-logo-windows-vista-microsoft-orange-computer-wallpaper-sphere-thumbnail.png";
    if (name.includes("vista")) return "https://upload.wikimedia.org/wikinews/en/f/f2/Windows_Vista_logo.png";
    if (name.includes("10")) return "https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Windows_logo_-_2012_%28dark_blue%29.svg/768px-Windows_logo_-_2012_%28dark_blue%29.svg.png";
    if (name.includes("11")) return "https://w7.pngwing.com/pngs/685/385/png-transparent-windows-11.png";
    return "https://img.icons8.com/color/600/proxmox.png";
  }
  return "https://static.vecteezy.com/system/resources/thumbnails/021/048/718/small_2x/geometric-design-element-free-png.png";
}

function VMManager() {
  const { user } = useUser();
  const [osList, setOsList] = useState<string[]>([]);
  const [selectedOS, setSelectedOS] = useState<string>("");
  const [vmName, setVmName] = useState<string>("");
  const [vmCores, setVmCores] = useState<number>(2);
  const [vmRam, setVmRam] = useState<number>(2048);
  const [vmDisk, setVmDisk] = useState<number>(20);
  const [networks, setNetworks] = useState<Network[]>([{ bridge: "vmbr0", model: "virtio" }]);
  const [storages, setStorages] = useState<Storage[]>([]);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [vmList, setVmList] = useState<VM[]>([]);
  const [vmCounter, setVmCounter] = useState<number>(100);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  // Get user identification from Clerk
  const userIdOrUsername = user?.id || "invited";
  const userEmail = user?.primaryEmailAddress?.emailAddress || "No email";

  // Safe access to objects with string keys - Use Clerk user info
  const userKey = userIdOrUsername as keyof typeof DEFAULT_QUOTAS;
  const quotas = DEFAULT_QUOTAS[userKey] || DEFAULT_QUOTAS["invited"];
  const profile = {
    ...USER_PROFILES[userKey] || USER_PROFILES["invited"],
    // Override with actual user data if available
    nom: userEmail, // Now showing email instead of name
    role: USER_PROFILES[userKey]?.role || "Utilisateur"
  };

  const userVMs = useMemo(() => vmList.filter(vm => vm.owner === userIdOrUsername), [vmList, userIdOrUsername]);
  const usedRam = useMemo(() => userVMs.reduce((acc, vm) => acc + vm.ram, 0), [userVMs]);
  const usedDisk = useMemo(() => userVMs.reduce((acc, vm) => acc + vm.disk + (vm.storages?.reduce((sAcc: number, s: Storage) => sAcc + s.size, 0) || 0), 0), [userVMs]);

  useEffect(() => {
    setOsList([
      "ubuntu-22.04", "ubuntu-20.04", "ubuntu-18.04",
      "debian-12", "debian-11", "debian-10",
      "centos-7", "centos-8",
      "windows-xp", "windows-7", "windows-vista", "windows-10", "windows-11"
    ]);
  }, []);

  return (
    <div className="w-screen p-4 space-y-6 text-foreground">
      <h1 className="text-2xl font-bold">Créer une VM Proxmox</h1>

      <Card>
        <CardContent className="pt-4 space-y-2 text-sm">
          <h2 className="text-lg font-semibold">Mon Profil</h2>
          <p><strong>Email :</strong> {userEmail}</p>
          <p><strong>Rôle :</strong> {profile.role}</p>
          <p><strong>Quota RAM :</strong> {usedRam} / {quotas.ram} Mo</p>
          <Progress value={(usedRam / quotas.ram) * 100} className="h-2" />
          <p><strong>Quota Stockage :</strong> {usedDisk} / {quotas.storage} Go</p>
          <Progress value={(usedDisk / quotas.storage) * 100} className="h-2" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">Nom de la VM</label>
            <Input value={vmName} onChange={e => setVmName(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">Système d'exploitation</label>
            <Select onValueChange={setSelectedOS}>
              <SelectTrigger className="border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground">
                <SelectValue placeholder="Choisir un OS" className="text-foreground" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-input">
                {osList.map(os => (
                  <SelectItem key={os} value={os} className="text-popover-foreground hover:bg-accent hover:text-accent-foreground">
                    {os}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">CPU (coeurs)</label>
            <Input type="number" value={vmCores} onChange={e => setVmCores(Number(e.target.value))} min={1} className="text-foreground" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">RAM (Mo)</label>
            <Input type="number" value={vmRam} onChange={e => setVmRam(Number(e.target.value))} min={512} className="text-foreground" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">Disque principal (Go)</label>
            <Input type="number" value={vmDisk} onChange={e => setVmDisk(Number(e.target.value))} min={5} className="text-foreground" />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">Cartes réseau</label>
            {networks.map((net, i) => (
              <div key={i} className="flex gap-2">
                <Input className="flex-1 text-foreground" value={net.bridge} onChange={e => {
                  const updated = [...networks];
                  updated[i].bridge = e.target.value;
                  setNetworks(updated);
                }} placeholder="Bridge (ex: vmbr0)" />
                <Input className="flex-1 text-foreground" value={net.model} onChange={e => {
                  const updated = [...networks];
                  updated[i].model = e.target.value;
                  setNetworks(updated);
                }} placeholder="Modèle (ex: virtio)" />
              </div>
            ))}
            <Button type="button" onClick={() => setNetworks([...networks, { bridge: "vmbr0", model: "virtio" }])} 
              className="bg-primary text-primary-foreground hover:bg-primary/90">
              ➕ Ajouter une carte réseau
            </Button>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">Stockage supplémentaire (optionnel)</label>
            {storages.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Input className="flex-1 text-foreground" type="number" value={s.size} onChange={e => {
                  const updated = [...storages];
                  updated[i].size = Number(e.target.value);
                  setStorages(updated);
                }} placeholder="Taille (Go)" />
                <Input className="flex-1 text-foreground" value={s.storage} onChange={e => {
                  const updated = [...storages];
                  updated[i].storage = e.target.value;
                  setStorages(updated);
                }} placeholder="Nom du stockage (ex: local-lvm)" />
              </div>
            ))}
            <Button type="button" onClick={() => setStorages([...storages, { size: 10, storage: "local-lvm" }])}
              className="bg-primary text-primary-foreground hover:bg-primary/90">
              ➕ Ajouter un disque
            </Button>
          </div>

          <Button onClick={() => setShowConfirm(true)} disabled={isCreating}
            className="bg-primary text-primary-foreground hover:bg-primary/90">
            {isCreating ? "Création..." : "Créer la VM"}
          </Button>
          {message && <p className="text-sm mt-2 font-medium text-green-600 dark:text-green-400">{message}</p>}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-semibold mt-6 mb-4">Mes VMs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {userVMs.map(vm => (
            <Card key={vm.vmid} className="border p-4 space-y-2">
              <div className="flex items-start gap-2">
                <img src={getOsIcon(vm.os)} alt={vm.os} className="w-6 h-6 object-contain" />
                <div>
                  <h3 className="text-lg font-semibold">{vm.name}</h3>
                  <p className="text-sm text-muted-foreground">{vm.os} — {vm.cores} CPU, {vm.ram} Mo RAM</p>
                  <p className="text-sm text-muted-foreground">Disque : {vm.disk} Go + {vm.storages?.reduce((a: number, s: Storage) => a + s.size, 0)} Go</p>
                  <p className={`text-xs font-semibold ${vm.status === 'running' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {vm.status === 'running' ? '🟢 En cours' : '🔴 Arrêtée'} — 👤 {vm.owner}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  setVmList(prev => prev.map(v => v.vmid === vm.vmid ? { ...v, status: v.status === "running" ? "stopped" : "running" } : v));
                }} className="border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground">
                  {vm.status === 'running' ? 'Arrêter' : 'Démarrer'}
                </Button>
                <Button variant="destructive" onClick={() => {
                  setVmList(prev => prev.filter(v => v.vmid !== vm.vmid));
                }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Supprimer
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la création de la VM</DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-1 text-foreground">
            <p><strong>Nom :</strong> {vmName}</p>
            <p><strong>OS :</strong> {selectedOS}</p>
            <p><strong>CPU :</strong> {vmCores} coeurs</p>
            <p><strong>RAM :</strong> {vmRam} Mo</p>
            <p><strong>Disque principal :</strong> {vmDisk} Go</p>
            <p><strong>Stockages supplémentaires :</strong> {storages.length} disque(s)</p>
            <p><strong>Cartes réseau :</strong> {networks.length}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)} 
              className="border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground">
              Annuler
            </Button>
            <Button onClick={() => {
              const newVM: VM = {
                vmid: vmCounter,
                name: vmName,
                os: selectedOS,
                cores: vmCores,
                ram: vmRam,
                disk: vmDisk,
                networks,
                storages,
                status: "stopped",
                owner: userIdOrUsername
              };
              setVmList(prev => [...prev, newVM]);
              setVmCounter(prev => prev + 1);
              setMessage(`✅ VM simulée avec succès : ${newVM.vmid}`);
              setIsCreating(false);
              setShowConfirm(false);
            }} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function App() {
  return (
    <div className="text-foreground bg-background min-h-screen">
      <header className="p-4 flex justify-end items-center">
        <SignedOut>
          <SignInButton />
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </header>
      
      <main>
        <SignedIn>
          <VMManager />
        </SignedIn>
        <SignedOut>
          <div className="flex flex-col items-center justify-center h-[80vh] text-center p-4">
            <h2 className="text-2xl font-bold mb-4">Accès restreint</h2>
            <p className="mb-6 text-muted-foreground">Vous devez vous connecter pour accéder au gestionnaire de VM Proxmox</p>
            <SignInButton mode="modal">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                Se connecter
              </Button>
            </SignInButton>
          </div>
        </SignedOut>
      </main>
    </div>
  );
}