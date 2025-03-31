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
  role: string;
  description: string;
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
const ROLE_QUOTAS: Record<string, Quota> = {
  admin: { ram: 32768, storage: 250 },
  developer: { ram: 16384, storage: 150 },
  user: { ram: 8192, storage: 100 },
};

const ROLE_PROFILES: Record<string, UserProfile> = {
  admin: { role: "administrator", description: "Full system access" },
  developer: { role: "developer", description: "Extended VM resources" },
  user: { role: "user", description: "Standard VM resources" },
};

function getOsIcon(os: string): string {
  const name = os.toLowerCase();
  if (name.includes("ubuntu")) return "https://companieslogo.com/img/orig/ubuntu-ace93e08.png";
  if (name.includes("debian")) return "https://companieslogo.com/img/orig/debian-7e44a05f.png";
  if (name.includes("centos")) return "https://upload.wikimedia.org/wikipedia/commons/9/9e/CentOS_Mark.svg";
  if (name.includes("windows")) {
    if (name.includes("xp")) return "https://upload.wikimedia.org/wikipedia/commons/3/32/Windows_XP_logo.svg";
    if (name.includes("7")) return "https://upload.wikimedia.org/wikipedia/commons/3/34/Windows_7_logo.svg";
    if (name.includes("vista")) return "https://upload.wikimedia.org/wikipedia/commons/0/0e/Windows_Vista_logo.svg";
    if (name.includes("10")) return "https://companieslogo.com/img/orig/MSFT-a203b22d.png";
    if (name.includes("11")) return "https://companieslogo.com/img/orig/MSFT-a203b22d.png";
    return "https://upload.wikimedia.org/wikipedia/commons/5/5f/Windows_logo_-_2002.svg";
  }
  return "https://upload.wikimedia.org/wikipedia/commons/6/6a/Blank_Circle.svg";
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
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Get user identification from Clerk
  const userEmail = user?.primaryEmailAddress?.emailAddress || "No email";
  
  // Get user role from metadata
  const userRole = (user?.publicMetadata?.role as string);
  
  // Get quotas based on role
  const quotas = ROLE_QUOTAS[userRole];
  const profile = ROLE_PROFILES[userRole];

  const userVMs = useMemo(() => vmList.filter(vm => vm.owner === userEmail), [vmList, userEmail]);
  const usedRam = useMemo(() => userVMs.reduce((acc, vm) => acc + vm.ram, 0), [userVMs]);
  const usedDisk = useMemo(() => userVMs.reduce((acc, vm) => acc + vm.disk + (vm.storages?.reduce((sAcc: number, s: Storage) => sAcc + s.size, 0) || 0), 0), [userVMs]);

  // Check if current request would exceed quota limits
  const wouldExceedQuota = (ramRequest: number, diskRequest: number): boolean => {
    const totalRamRequest = usedRam + ramRequest;
    const totalDiskRequest = usedDisk + diskRequest;
    
    return totalRamRequest > quotas.ram || totalDiskRequest > quotas.storage;
  };

  useEffect(() => {
    setOsList([
      "ubuntu-22.04", "ubuntu-20.04", "ubuntu-18.04",
      "debian-12", "debian-11", "debian-10",
      "centos-7", "centos-8",
      "windows-xp", "windows-7", "windows-vista", "windows-10", "windows-11"
    ]);
  }, []);

  return (
    <div className="w-screen p-4 space-y-6">
      <h1 className="text-2xl font-bold">Créer une VM Proxmox</h1>

      <Card>
        <CardContent className="pt-4 space-y-2 text-sm">
          <h2 className="text-lg font-semibold">Mon Profil</h2>
          <p><strong>Email :</strong> {userEmail}</p>
          <p><strong>Rôle :</strong> {profile.role}</p>
          <p><strong>Description :</strong> {profile.description}</p>
          <p><strong>Quota RAM :</strong> {usedRam} / {quotas.ram} Mo</p>
          <Progress value={(usedRam / quotas.ram) * 100} className="h-2" />
          <p><strong>Quota Stockage :</strong> {usedDisk} / {quotas.storage} Go</p>
          <Progress value={(usedDisk / quotas.storage) * 100} className="h-2" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nom de la VM</label>
            <Input value={vmName} onChange={e => setVmName(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Système d'exploitation</label>
            <Select onValueChange={setSelectedOS}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un OS" />
              </SelectTrigger>
              <SelectContent>
                {osList.map(os => (
                  <SelectItem key={os} value={os}>{os}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">CPU (coeurs)</label>
            <Input type="number" value={vmCores} onChange={e => setVmCores(Number(e.target.value))} min={1} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">RAM (Mo)</label>
            <Input type="number" value={vmRam} onChange={e => setVmRam(Number(e.target.value))} min={512} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Disque principal (Go)</label>
            <Input type="number" value={vmDisk} onChange={e => setVmDisk(Number(e.target.value))} min={5} />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Cartes réseau</label>
            {networks.map((net, i) => (
              <div key={i} className="flex gap-2">
                <Input className="flex-1" value={net.bridge} onChange={e => {
                  const updated = [...networks];
                  updated[i].bridge = e.target.value;
                  setNetworks(updated);
                }} placeholder="Bridge (ex: vmbr0)" />
                <Input className="flex-1" value={net.model} onChange={e => {
                  const updated = [...networks];
                  updated[i].model = e.target.value;
                  setNetworks(updated);
                }} placeholder="Modèle (ex: virtio)" />
              </div>
            ))}
            <Button type="button" onClick={() => setNetworks([...networks, { bridge: "vmbr0", model: "virtio" }])}>
              ➕ Ajouter une carte réseau
            </Button>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Stockage supplémentaire (optionnel)</label>
            {storages.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Input className="flex-1" type="number" value={s.size} onChange={e => {
                  const updated = [...storages];
                  updated[i].size = Number(e.target.value);
                  setStorages(updated);
                }} placeholder="Taille (Go)" />
                <Input className="flex-1" value={s.storage} onChange={e => {
                  const updated = [...storages];
                  updated[i].storage = e.target.value;
                  setStorages(updated);
                }} placeholder="Nom du stockage (ex: local-lvm)" />
              </div>
            ))}
            <Button type="button" onClick={() => setStorages([...storages, { size: 10, storage: "local-lvm" }])}>
              ➕ Ajouter un disque
            </Button>
          </div>

          <Button onClick={() => {
            // Calculate total disk size including additional storage
            const totalDiskSize = vmDisk + storages.reduce((total, s) => total + s.size, 0);
            
            if (wouldExceedQuota(vmRam, totalDiskSize)) {
              setErrorMessage("La création de cette VM dépasserait vos quotas alloués");
            } else {
              setErrorMessage("");
              setShowConfirm(true);
            }
          }} disabled={isCreating}>
            {isCreating ? "Création..." : "Créer la VM"}
          </Button>
          {message && <p className="text-sm mt-2 text-green-600">{message}</p>}
          {errorMessage && <p className="text-sm mt-2 text-red-600">{errorMessage}</p>}
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
                  <p className="text-sm text-gray-500">{vm.os} — {vm.cores} CPU, {vm.ram} Mo RAM</p>
                  <p className="text-sm text-gray-500">Disque : {vm.disk} Go + {vm.storages?.reduce((a: number, s: Storage) => a + s.size, 0)} Go</p>
                  <p className={`text-xs font-semibold ${vm.status === 'running' ? 'text-green-600' : 'text-red-600'}`}>
                    {vm.status === 'running' ? '🟢 En cours' : '🔴 Arrêtée'} — 👤 {vm.owner}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  setVmList(prev => prev.map(v => v.vmid === vm.vmid ? { ...v, status: v.status === "running" ? "stopped" : "running" } : v));
                }}>
                  {vm.status === 'running' ? 'Arrêter' : 'Démarrer'}
                </Button>
                <Button variant="destructive" onClick={() => {
                  setVmList(prev => prev.filter(v => v.vmid !== vm.vmid));
                }}>
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
          <div className="text-sm space-y-1">
            <p><strong>Nom :</strong> {vmName}</p>
            <p><strong>OS :</strong> {selectedOS}</p>
            <p><strong>CPU :</strong> {vmCores} coeurs</p>
            <p><strong>RAM :</strong> {vmRam} Mo</p>
            <p><strong>Disque principal :</strong> {vmDisk} Go</p>
            <p><strong>Stockages supplémentaires :</strong> {storages.length} disque(s)</p>
            <p><strong>Cartes réseau :</strong> {networks.length}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Annuler</Button>
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
                owner: userEmail
              };
              setVmList(prev => [...prev, newVM]);
              setVmCounter(prev => prev + 1);
              setMessage(`✅ VM simulée avec succès : ${newVM.vmid}`);
              setIsCreating(false);
              setShowConfirm(false);
            }}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function App() {
  return (
    <div>
      <header className="p-4 flex justify-end">
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
            <p className="mb-6">Vous devez vous connecter pour accéder au gestionnaire de VM Proxmox</p>
            <SignInButton mode="modal">
              <Button size="lg">Se connecter</Button>
            </SignInButton>
          </div>
        </SignedOut>
      </main>
    </div>
  );
}