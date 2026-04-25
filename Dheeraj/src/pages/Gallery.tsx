import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Plus, Search, Grid, List, MoreVertical, Calendar, 
  Image as ImageIcon, Filter, Loader2, Trash2, Edit2
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

import { useI18n } from "@/context/I18nContext";

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const Gallery = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [albums, setAlbums] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAlbum, setNewAlbum] = useState({
    name: "",
    album_type: "general",
    booking_id: "",
    inventory_item_id: ""
  });

  const [renameModal, setRenameModal] = useState<{show: boolean, id: any, name: string}>({ show: false, id: null, name: "" });

  useEffect(() => {
    fetchAlbums();
  }, [filter, sort]);

  const fetchAlbums = async () => {
    setLoading(true);
    try {
      const data = await api.getAlbums({ type: filter, sort, search });
      setAlbums(data);
    } catch (err) {
      toast.error("Failed to fetch albums");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAlbums();
  };

  const createAlbum = async () => {
    if (!newAlbum.name) return toast.error("Album name is required");
    try {
      await api.createAlbum(newAlbum);
      toast.success("Album created");
      setShowCreateModal(false);
      setNewAlbum({ name: "", album_type: "general", booking_id: "", inventory_item_id: "" });
      fetchAlbums();
    } catch (err) {
      toast.error("Failed to create album");
    }
  };

  const deleteAlbum = async (id: number, name: string, count: number) => {
    if (!confirm(`Delete album "${name}"? All ${count} photos will be permanently deleted.`)) return;
    try {
      await api.deleteAlbum(id);
      toast.success("Album deleted");
      fetchAlbums();
    } catch (err) {
      toast.error("Failed to delete album");
    }
  };

  const renameAlbum = async () => {
    if (!renameModal.name.trim()) return;
    try {
      await api.updateAlbum(renameModal.id, { name: renameModal.name });
      toast.success("Album renamed");
      setRenameModal({ show: false, id: null, name: "" });
      fetchAlbums();
    } catch (err) {
      toast.error("Failed to rename album");
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'booking': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'inventory': return 'bg-green-500/10 text-green-500 border-green-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("gallery")}</h1>
          <p className="text-muted-foreground">{t("gallerySubtitle")}</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="hidden md:flex gap-2">
          <Plus className="h-4 w-4" /> {t("newAlbum")}
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-3 rounded-lg border shadow-sm">
        <form onSubmit={handleSearch} className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder={t("search")} 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </form>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full md:w-40"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder={t("all")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all")}</SelectItem>
              <SelectItem value="booking">{t("bookings")}</SelectItem>
              <SelectItem value="inventory">{t("inventory")}</SelectItem>
              <SelectItem value="general">{t("other")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-full md:w-40"><SelectValue placeholder={t("all")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t("thisMonth")}</SelectItem>
              <SelectItem value="oldest">{t("allTimeRecords")}</SelectItem>
              <SelectItem value="name_asc">{t("name")}</SelectItem>
              <SelectItem value="most_photos">{t("gallery")}</SelectItem>
            </SelectContent>
          </Select>
          <div className="hidden md:flex items-center border rounded-md p-1 bg-muted/50">
            <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('grid')}><Grid className="h-4 w-4" /></Button>
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('list')}><List className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-10 w-10 animate-spin mb-4" />
          <p>{t("loading")}</p>
        </div>
      ) : albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-muted/20 rounded-xl border-2 border-dashed">
          <ImageIcon className="h-16 w-16 mb-4 opacity-20" />
          <p className="text-xl font-medium">{t("noPhotosYet")}</p>
          <p>{t("pickCategoryFirst")}</p>
          <Button variant="outline" className="mt-4" onClick={() => setShowCreateModal(true)}>{t("newAlbum")}</Button>
        </div>
      ) : (
        <div className={viewMode === 'grid' 
          ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6" 
          : "space-y-2"
        }>
          {albums.map((album) => (
            <Card key={album.id} className={`group overflow-hidden hover:shadow-md transition-all cursor-pointer ${viewMode === 'list' ? 'flex items-center p-3 gap-4' : ''}`} onClick={() => navigate(`/gallery/album/${album.id}`)}>
              {viewMode === 'grid' ? (
                <>
                  <div className="aspect-[4/3] relative bg-muted flex items-center justify-center overflow-hidden">
                    {album.cover_photo_path ? (
                      <img 
                        src={`${API_BASE_URL}/${album.cover_photo_path}`} 
                        alt={album.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <ImageIcon className="h-12 w-12 opacity-20" />
                    )}
                    <Badge className={`absolute top-2 left-2 capitalize border ${getBadgeColor(album.album_type)}`}>
                      {album.album_type}
                    </Badge>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="secondary" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur-sm"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setRenameModal({ show: true, id: album.id, name: album.name })}><Edit2 className="h-4 w-4 mr-2" /> {t("edit")}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteAlbum(album.id, album.name, album.photo_count)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> {t("delete")}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-6">
                      <p className="text-white text-xs font-medium">{album.photo_count} photos</p>
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold truncate text-sm">{album.name}</h3>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(album.created_at), 'MMM dd, yyyy')}
                    </div>
                    {album.booking_id && <div className="mt-1 text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded w-fit">ID: {album.booking_id}</div>}
                  </div>
                </>
              ) : (
                <>
                  <div className="h-12 w-12 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {album.cover_photo_path ? (
                      <img src={`${API_BASE_URL}/${album.cover_photo_path}`} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="h-6 w-6 opacity-20" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold truncate text-sm">{album.name}</h3>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="capitalize">{album.album_type}</span>
                      <span>•</span>
                      <span>{album.photo_count} photos</span>
                      <span>•</span>
                      <span>{format(new Date(album.created_at), 'MMM dd, yyyy')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => setRenameModal({ show: true, id: album.id, name: album.name })}><Edit2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteAlbum(album.id, album.name, album.photo_count)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* FAB for Mobile */}
      <Button 
        className="fixed bottom-20 right-6 h-14 w-14 rounded-full shadow-2xl md:hidden z-50" 
        onClick={() => setShowCreateModal(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Create Album Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("newAlbum")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("name")}</label>
              <Input placeholder={t("newCategoryName")} value={newAlbum.name} onChange={e => setNewAlbum({...newAlbum, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("type")}</label>
              <Select value={newAlbum.album_type} onValueChange={v => setNewAlbum({...newAlbum, album_type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="booking">{t("bookings")}</SelectItem>
                  <SelectItem value="inventory">{t("inventory")}</SelectItem>
                  <SelectItem value="general">{t("other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* TODO: Add search for bookings/items if needed in v2 */}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>{t("cancel")}</Button>
            <Button onClick={createAlbum}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Modal */}
      <Dialog open={renameModal.show} onOpenChange={v => !v && setRenameModal({ ...renameModal, show: false })}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("renameCategory")}</DialogTitle></DialogHeader>
          <div className="py-4">
            <Input value={renameModal.name} onChange={e => setRenameModal({...renameModal, name: e.target.value})} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameModal({ ...renameModal, show: false })}>{t("cancel")}</Button>
            <Button onClick={renameAlbum}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Gallery;
