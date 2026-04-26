import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Download, Trash2, Edit2, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";

const FILE_BASE_URL = ''; // Files are served from root /uploads


interface PhotoViewerProps {
  photos: any[];
  initialIndex: number;
  onClose: () => void;
  onDelete: () => void;
}

export const PhotoViewer = ({ photos, initialIndex, onClose, onDelete }: PhotoViewerProps) => {
  const [index, setIndex] = useState(initialIndex);
  const [isEditing, setIsEditing] = useState(false);
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);

  const photo = photos[index];

  useEffect(() => {
    if (photo) {
      setCaption(photo.caption || "");
      setTags(photo.tags ? photo.tags.join(", ") : "");
    }
  }, [photo]);

  const handleNext = useCallback(() => {
    setIndex((prev) => (prev + 1) % photos.length);
    setIsEditing(false);
  }, [photos.length]);

  const handlePrev = useCallback(() => {
    setIndex((prev) => (prev - 1 + photos.length) % photos.length);
    setIsEditing(false);
  }, [photos.length]);

  const handleDelete = async () => {
    if (!confirm("Delete this photo permanently?")) return;
    try {
      await api.deletePhoto(photo.id);
      toast.success("Photo deleted");
      onDelete();
    } catch (err) {
      toast.error("Failed to delete photo");
    }
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      await api.updatePhoto(photo.id, { 
        caption, 
        tags: tags.split(',').map(t => t.trim()).filter(t => t)
      });
      toast.success("Photo updated");
      setIsEditing(false);
      // We don't refresh the whole list here for performance, 
      // but in a real app we'd update the local state.
    } catch (err) {
      toast.error("Failed to update photo");
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    window.open(`/api/gallery/photos/${photo.id}/download`, '_blank');
  };


  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onClose]);

  if (!photo) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex flex-col animate-in fade-in zoom-in duration-200">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 text-white z-10 bg-gradient-to-b from-black/50 to-transparent">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20"><X className="h-6 w-6" /></Button>
          <div className="hidden sm:block">
            <p className="text-sm font-medium">{index + 1} / {photos.length}</p>
            <p className="text-[10px] opacity-60">{photo.original_filename}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleDownload} className="text-white hover:bg-white/20"><Download className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setIsEditing(!isEditing)} className={`text-white hover:bg-white/20 ${isEditing ? 'bg-white/20' : ''}`}><Edit2 className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" onClick={handleDelete} className="text-white hover:bg-red-500/20 text-red-400"><Trash2 className="h-5 w-5" /></Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative flex items-center justify-center p-4 sm:p-8">
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute left-4 z-10 text-white h-12 w-12 rounded-full bg-black/20 hover:bg-black/40 hidden sm:flex" 
          onClick={handlePrev}
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
        
        <div className="relative max-w-full max-h-full group">
          <img 
            src={`${FILE_BASE_URL}/${photo.file_path}`} 
            alt={photo.caption || "Gallery"} 
            className="max-w-full max-h-[80vh] object-contain shadow-2xl rounded"
          />
          
          {/* Mobile Tap Areas for Navigation */}
          <div className="absolute inset-y-0 left-0 w-1/4 sm:hidden" onClick={(e) => { e.stopPropagation(); handlePrev(); }} />
          <div className="absolute inset-y-0 right-0 w-1/4 sm:hidden" onClick={(e) => { e.stopPropagation(); handleNext(); }} />

        </div>

        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute right-4 z-10 text-white h-12 w-12 rounded-full bg-black/20 hover:bg-black/40 hidden sm:flex" 
          onClick={handleNext}
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      </div>

      {/* Bottom Bar / Details */}
      <div className="bg-gradient-to-t from-black/80 to-transparent p-6 text-white min-h-[120px]">
        {isEditing ? (
          <div className="max-w-2xl mx-auto space-y-3">
            <div className="flex gap-2">
              <Input 
                value={caption} 
                onChange={e => setCaption(e.target.value)} 
                placeholder="Add a caption..." 
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
              <Button onClick={handleSave} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
            </div>
            <Input 
              value={tags} 
              onChange={e => setTags(e.target.value)} 
              placeholder="Tags (comma separated)..." 
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 text-xs"
            />
          </div>
        ) : (
          <div className="max-w-2xl mx-auto text-center space-y-2">
            <h3 className="text-lg font-medium">{photo.caption || "No caption"}</h3>
            <div className="flex flex-wrap justify-center gap-1.5 mt-2">
              {photo.tags?.map((tag: string, i: number) => (
                <Badge key={i} variant="secondary" className="bg-white/10 text-white border-white/10 text-[10px]">#{tag}</Badge>
              ))}
            </div>
            <p className="text-[10px] opacity-60 mt-2">Uploaded on {format(new Date(photo.created_at), 'MMMM dd, yyyy')}</p>
          </div>
        )}
      </div>

      {/* Mobile Navigation Arrows Overlay */}
      <div className="sm:hidden absolute inset-y-0 left-0 flex items-center px-2 pointer-events-none">
         <Button variant="ghost" size="icon" className="text-white h-10 w-10 bg-black/20 rounded-full pointer-events-auto" onClick={handlePrev}><ChevronLeft className="h-6 w-6" /></Button>
      </div>
      <div className="sm:hidden absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
         <Button variant="ghost" size="icon" className="text-white h-10 w-10 bg-black/20 rounded-full pointer-events-auto" onClick={handleNext}><ChevronRight className="h-6 w-6" /></Button>
      </div>

    </div>
  );
};
