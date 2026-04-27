import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { 
  ArrowLeft, Plus, Trash2, Check, X, 
  Download, Loader2, Image as ImageIcon,
  MoreVertical, CheckSquare, Square, Move, Upload
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/context/I18nContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhotoViewer } from "@/components/gallery/PhotoViewer";

const API_BASE_URL = '/api';
const FILE_BASE_URL = ''; // Files are served from root /uploads



const AlbumView = () => {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const [album, setAlbum] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectMode, setSelectMode] = useState(false);

  // Upload
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] =false;
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Viewer
  const [viewerPhoto, setViewerPhoto] = useState<any>(null);

  // Move Modal
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [allAlbums, setAllAlbums] = useState<any[]>([]);
  const [targetAlbumId, setTargetAlbumId] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const albums = await api.getAlbums();
      const current = albums.find((a: any) => a.id.toString() === id);
      setAlbum(current);
      
      const photoData = await api.getAlbumPhotos(id);
      setPhotos(photoData);
      setAllAlbums(albums.filter((a: any) => a.id.toString() !== id));
    } catch (err) {
      toast.error("Failed to load album");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    // Check size (10MB)
    const validFiles = files.filter(f => {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name} is too large (max 10MB)`);
        return false;
      }
      return true;
    });

    setUploadFiles([...uploadFiles, ...validFiles]);
    
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    setUploadFiles(uploadFiles.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const uploadPhotos = async () => {
    if (uploadFiles.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    uploadFiles.forEach(file => formData.append('photos', file));
    
    try {
      await api.uploadPhotos(id!, formData);
      toast.success(`${uploadFiles.length} photos uploaded`);
      setShowUploadModal(false);
      setUploadFiles([]);
      setPreviews([]);
      fetchData();
    } catch (err) {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    if (selectedIds.length === photos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(photos.map(p => p.id));
    }
  };

  const deleteSelected = async () => {
    if (!confirm(`Delete ${selectedIds.length} photos? This cannot be undone.`)) return;
    
    const previousPhotos = [...photos];
    setPhotos(prev => prev.filter(p => !selectedIds.includes(p.id)));

    try {
      await api.deletePhotosBulk(selectedIds);
      toast.success("Photos deleted");
      setSelectedIds([]);
      setSelectMode(false);
      fetchData();
    } catch (err) {
      setPhotos(previousPhotos);
      toast.error("Failed to delete photos");
    }
  };

  const moveSelected = async () => {
    if (!targetAlbumId) return;
    try {
      await api.movePhotos(selectedIds, Number(targetAlbumId));
      toast.success("Photos moved");
      setSelectedIds([]);
      setSelectMode(false);
      setShowMoveModal(false);
      fetchData();
    } catch (err) {
      toast.error("Failed to move photos");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium">{t("loading")}...</p>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-2xl font-bold">{t("noRecordsFound")}</h2>
        <Button variant="link" onClick={() => navigate('/gallery')}>{t("back")}</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/gallery')}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{album.name}</h1>
              <Badge className="capitalize">{t(album.album_type)}</Badge>
            </div>
            {album.booking_id && (
              <p className="text-xs text-muted-foreground mt-0.5">Linked to Booking: <span className="font-mono font-bold text-primary">{album.booking_id}</span></p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <Button variant="outline" size="sm" onClick={selectAll} className="gap-2">
                {selectedIds.length === photos.length ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                {selectedIds.length === photos.length ? t("deselectAll") : t("selectAll")}
              </Button>
              <Button variant="destructive" size="sm" disabled={selectedIds.length === 0} onClick={deleteSelected} className="gap-2"><Trash2 className="h-4 w-4" /> {t("delete")}</Button>
              <Button variant="secondary" size="sm" disabled={selectedIds.length === 0} onClick={() => setShowMoveModal(true)} className="gap-2"><Move className="h-4 w-4" /> {t("move")}</Button>
              <Button variant="ghost" size="sm" onClick={() => { setSelectMode(false); setSelectedIds([]); }}><X className="h-4 w-4" /></Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setSelectMode(true)}>Select</Button>
              <Button size="sm" onClick={() => setShowUploadModal(true)} className="gap-2"><Plus className="h-4 w-4" /> Add Photos</Button>
            </>
          )}
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground bg-muted/10 rounded-xl border-2 border-dashed">
          <ImageIcon className="h-16 w-16 mb-4 opacity-20" />
          <p className="text-xl font-medium">{t("noRecordsFound")}</p>
          <p>{t("uploadPhotoHint")}</p>
          <Button variant="outline" className="mt-6" onClick={() => setShowUploadModal(true)}>{t("uploadPhoto")}</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
          {photos.map((photo) => (
            <div 
              key={photo.id} 
              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer group ${selectedIds.includes(photo.id) ? 'border-primary shadow-lg ring-2 ring-primary/20' : 'border-transparent hover:border-muted-foreground/30'}`}
              onClick={() => selectMode ? toggleSelect(photo.id) : setViewerPhoto(photo)}
            >
              <img 
                src={`${FILE_BASE_URL}/${photo.file_path}`} 
                className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                loading="lazy" 
              />

              
              {/* Overlay for selection */}
              {(selectMode || selectedIds.includes(photo.id)) && (
                <div className={`absolute inset-0 bg-black/20 transition-opacity ${selectedIds.includes(photo.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  <div className={`absolute top-2 left-2 h-6 w-6 rounded-md border-2 flex items-center justify-center ${selectedIds.includes(photo.id) ? 'bg-primary border-primary text-white' : 'bg-white/50 border-white text-transparent'}`}>
                    <Check className="h-4 w-4" />
                  </div>
                </div>
              )}
              
              {!selectMode && (
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[10px] text-white truncate">{photo.caption || format(new Date(photo.created_at), 'MMM dd')}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* FAB for Mobile Upload */}
      <Button 
        className="fixed bottom-20 right-6 h-14 w-14 rounded-full shadow-2xl md:hidden z-50" 
        onClick={() => setShowUploadModal(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>{t("uploadPhoto")} - {album.name}</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            <div 
              className="border-2 border-dashed rounded-xl p-8 text-center bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">{t("uploadPhoto")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("uploadPhotoHint")}</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                multiple 
                accept="image/*" 
                className="hidden" 
                onChange={handleFileSelect} 
              />
            </div>

            {previews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                {previews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-md overflow-hidden border group">
                    <img src={src} className="w-full h-full object-cover" />
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={() => removeFile(i)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1">
                      <p className="text-[8px] text-white truncate text-center">{(uploadFiles[i].size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setShowUploadModal(false)}>{t("cancel")}</Button>
            <Button onClick={uploadPhotos} disabled={uploadFiles.length === 0 || uploading} className="gap-2">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {uploading ? t("uploading") : `${t("save")} ${uploadFiles.length} Photos`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Modal */}
      <Dialog open={showMoveModal} onOpenChange={setShowMoveModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Move {selectedIds.length} Photos</DialogTitle></DialogHeader>
          <div className="py-4 space-y-2">
            <label className="text-sm font-medium">Target Album</label>
            <Select value={targetAlbumId} onValueChange={setTargetAlbumId}>
              <SelectTrigger><SelectValue placeholder="Select Destination" /></SelectTrigger>
              <SelectContent>
                {allAlbums.map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveModal(false)}>{t("cancel")}</Button>
            <Button onClick={moveSelected} disabled={!targetAlbumId}>{t("move")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {viewerPhoto && (
        <PhotoViewer 
          photos={photos} 
          initialIndex={photos.findIndex(p => p.id === viewerPhoto.id)} 
          onClose={() => setViewerPhoto(null)}
          onDelete={() => { setViewerPhoto(null); fetchData(); }}
        />
      )}
    </div>
  );
};

export default AlbumView;
