import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Search, AlertTriangle, Camera, Truck, ClipboardList, Minus, UserPlus, Phone } from "lucide-react";
import { fmtINR } from "@/lib/format";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";

const Inventory = () => {
  const { t } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [openItem, setOpenItem] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [openCategory, setOpenCategory] = useState(false);
  const [editCategory, setEditCategory] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const [it, cat] = await Promise.all([
        api.getItems(),
        api.getCategories(),
      ]);
      setItems(Array.isArray(it) ? it : []); 
      setCategories(Array.isArray(cat) ? cat : []);
    } catch (err) {
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = (items || []).filter((i) => 
    !search || 
    i.name?.toLowerCase().includes(search.toLowerCase())
  );
  
  const lowStock = (items || []).filter((i) => i.available_quantity !== null && i.available_quantity <= (i.low_stock_threshold || 0));

  const removeItem = async (id: number) => {
    if (!confirm(`Delete this item? This cannot be undone.`)) return;
    
    const previousItems = [...items];
    setItems(prev => prev.filter(i => i.id !== id));

    try {
      await api.deleteItem(id);
      toast.success("Item deleted");
      load();
    } catch (err) {
      setItems(previousItems);
      toast.error("Failed to delete item");
    }
  };

  const removeCategory = async (id: number) => {
    if (!confirm(`Delete this category? Items within this category will become Non-Category Items.`)) return;
    
    const previousCategories = [...categories];
    setCategories(prev => prev.filter(c => c.id !== id));

    try {
      await api.deleteCategory(id);
      toast.success("Category deleted");
      load();
    } catch (err) {
      setCategories(previousCategories);
      toast.error("Failed to delete category");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("inventory")}
        subtitle={t("inventorySubtitle")}
        actions={
          <div className="flex gap-2">
            <Dialog open={openCategory || !!editCategory} onOpenChange={(o) => { if (!o) { setOpenCategory(false); setEditCategory(null); } }}>
              <DialogTrigger asChild>
                  <Button onClick={() => setOpenCategory(true)} variant="outline" className="font-bold">
                      <Plus className="mr-2 h-4 w-4" /> {t("addCategory")}
                  </Button>
              </DialogTrigger>
              <CategoryDialog category={editCategory} categories={categories} onClose={() => { setOpenCategory(false); setEditCategory(null); load(); }} />
            </Dialog>
            <Dialog open={openItem || !!editItem} onOpenChange={(o) => { if (!o) { setOpenItem(false); setEditItem(null); } }}>
              <DialogTrigger asChild>
                  <Button onClick={() => setOpenItem(true)} className="bg-primary hover:bg-primary/90 font-bold">
                      <Plus className="mr-2 h-4 w-4" /> {t("addItem")}
                  </Button>
              </DialogTrigger>
              <ItemDialog item={editItem} categories={categories} onClose={() => { setOpenItem(false); setEditItem(null); load(); }} />
            </Dialog>
          </div>
        }
      />

      <Tabs defaultValue="stock" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-6">
          <TabsTrigger value="stock" className="font-bold">{t("inventory")}</TabsTrigger>
          <TabsTrigger value="borrow" className="font-bold flex items-center gap-2"><Truck className="h-4 w-4" /> {t("borrow")}</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {lowStock.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
              <div>
                <div className="font-medium">{lowStock.length} {t("lowStockWarning")}</div>
                <div className="text-sm text-muted-foreground mt-1">{lowStock.map(i => i.name).join(", ")}</div>
              </div>
            </div>
          )}

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")} className="pl-9" />
          </div>

          <div className="space-y-10">
            {(categories || []).map(c => {
              const itemsInCategory = filtered.filter(i => i.category_id === c.id);
              if (itemsInCategory.length === 0) return null;
              
              return (
                <section key={c.id} className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h2 className="text-xl font-bold">{c.name}</h2>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditCategory(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => removeCategory(c.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <ItemTable items={itemsInCategory} categories={categories} onEdit={setEditItem} onDelete={removeItem} showCategory={false} />
                </section>
              );
            })}

            {(filtered.filter(i => i.category_id === null).length > 0) && (
              <section className="space-y-4">
                <h2 className="text-xl font-bold border-b pb-2">{t("nonCategoryItem")}</h2>
                <ItemTable items={filtered.filter(i => i.category_id === null)} categories={categories} onEdit={setEditItem} onDelete={removeItem} showCategory={false} />
              </section>
            )}
            
            {items.length === 0 && !loading && (
              <div className="text-center py-20 text-muted-foreground border border-dashed rounded-xl">
                {t("noItemsFound")}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="borrow" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <BorrowModule items={items} categories={categories} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// --- BORROW MODULE COMPONENTS ---

const BorrowModule = ({ items = [], categories = [] }: { items?: any[], categories?: any[] }) => {
  const { t } = useI18n();
  const [borrowers, setBorrowers] = useState<any[]>([]);
  const [selectedBorrower, setSelectedBorrower] = useState<any>(null);
  const [openBorrowerForm, setOpenBorrowerForm] = useState(false);
  const [editBorrower, setEditBorrower] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadBorrowers = async () => {
    try {
      setLoading(true);
      const data = await api.getVendors();
      const list = Array.isArray(data) ? data : [];
      setBorrowers(list);
      if (selectedBorrower) {
        const updated = list.find((b: any) => b.id === selectedBorrower.id);
        if (updated) setSelectedBorrower(updated);
      }
    } catch (err) {
      toast.error("Failed to load borrowers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBorrowers(); }, []);

  const removeBorrower = async (id: number) => {
    if (!confirm("Delete this borrower?")) return;
    
    const previousBorrowers = [...borrowers];
    setBorrowers(prev => prev.filter(b => b.id !== id));

    try {
      await api.deleteVendor(id);
      toast.success("Removed");
      setSelectedBorrower(null);
      loadBorrowers();
    } catch (err) {
      setBorrowers(previousBorrowers);
      toast.error("Failed to remove");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1 space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> {t("borrower")}
          </h3>
          <Button size="icon" variant="ghost" onClick={() => setOpenBorrowerForm(true)} className="h-8 w-8 text-primary"><UserPlus className="h-4 w-4" /></Button>
        </div>
        
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
          {(borrowers || []).map(b => (
            <div 
              key={b.id} 
              onClick={() => setSelectedBorrower(b)}
              className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/50 ${selectedBorrower?.id === b.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-card'}`}
            >
              <div className="font-bold truncate">{b.name}</div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1"><Phone className="h-2.5 w-2.5" /> {b.phone}</div>
            </div>
          ))}
          {borrowers.length === 0 && !loading && (
            <div className="text-center py-10 text-xs text-muted-foreground border border-dashed rounded-lg bg-muted/5">
              No borrowers found.
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-3">
        {selectedBorrower ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-muted/20 p-4 rounded-xl border border-dashed">
              <div>
                <h4 className="text-xl font-bold">{selectedBorrower.name}</h4>
                <p className="text-xs text-muted-foreground">{selectedBorrower.phone} • {selectedBorrower.notes || "No notes"}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditBorrower(selectedBorrower)}><Pencil className="h-3.5 w-3.5 mr-1.5" /> {t("edit")}</Button>
                <Button variant="outline" size="sm" onClick={() => removeBorrower(selectedBorrower.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5 mr-1.5" /> {t("delete")}</Button>
              </div>
            </div>

            <BorrowChecklist borrowerId={selectedBorrower.id} items={items} categories={categories} />
          </div>
        ) : (
          <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground border border-dashed rounded-2xl bg-muted/5 space-y-3">
             <div className="h-16 w-16 rounded-full bg-muted/20 flex items-center justify-center animate-pulse">
                <Truck className="h-8 w-8 opacity-40" />
             </div>
             <p className="text-sm">Select a borrower to manage items</p>
          </div>
        )}
      </div>

      <BorrowerDialog 
        isOpen={openBorrowerForm || !!editBorrower} 
        borrower={editBorrower} 
        onClose={() => { setOpenBorrowerForm(false); setEditBorrower(null); loadBorrowers(); }} 
      />
    </div>
  );
};

const BorrowChecklist = ({ borrowerId, items = [], categories = [] }: { borrowerId: number, items?: any[], categories?: any[] }) => {
  const { t } = useI18n();
  const [borrowedItems, setBorrowedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadBorrowed = async () => {
    try {
      setLoading(true);
      const data = await api.getVendorBorrows(borrowerId);
      setBorrowedItems(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error("Failed to load borrowed items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBorrowed(); }, [borrowerId]);

  const updateBorrow = async (it: any, delta: number) => {
    const existing = (borrowedItems || []).find(b => b.item_name === it.name);
    const newQty = (existing?.borrowed_quantity || 0) + delta;

    if (newQty < 0) return;

    // Optimistic update
    const previousBorrowed = [...borrowedItems];
    if (newQty === 0) {
      setBorrowedItems(prev => prev.filter(b => b.item_name !== it.name));
    } else if (existing) {
      setBorrowedItems(prev => prev.map(b => b.item_name === it.name ? { ...b, borrowed_quantity: newQty } : b));
    } else {
      setBorrowedItems(prev => [...prev, { item_name: it.name, borrowed_quantity: newQty, id: Date.now() }]);
    }

    try {
      if (newQty === 0 && existing) {
         await api.deleteBorrow(existing.id);
      } else {
         await api.createManualBorrow({ 
           vendor_id: borrowerId, 
           item_name: it.name, 
           item_id: it.id,
           quantity: newQty 
         });
      }
      loadBorrowed();
    } catch (err) {
      setBorrowedItems(previousBorrowed);
      toast.error("Update failed");
    }
  };


  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
      <div className="space-y-4">
        <h5 className="font-bold text-sm uppercase tracking-widest text-primary flex items-center gap-2">
           <div className="h-1.5 w-1.5 rounded-full bg-primary" /> {t("categoryItems")}
        </h5>
        <div className="space-y-3">
          {(categories || []).map(cat => {
            const catItems = (items || []).filter(i => i.category_id === cat.id);
            if (catItems.length === 0) return null;
            return (
              <div key={cat.id} className="space-y-2">
                <div className="text-[10px] font-bold uppercase text-muted-foreground px-1">{cat.name}</div>
                {catItems.map(it => (
                  <BorrowItemRow 
                    key={it.id} 
                    item={it} 
                    borrowedQty={(borrowedItems || []).find(b => b.item_name === it.name)?.borrowed_quantity || 0}
                    onUpdate={(d) => updateBorrow(it, d)}

                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <h5 className="font-bold text-sm uppercase tracking-widest text-primary flex items-center gap-2">
           <div className="h-1.5 w-1.5 rounded-full bg-primary" /> {t("other")}
        </h5>
        <div className="space-y-3">
          {(items || []).filter(i => i.category_id === null).map(it => (
            <BorrowItemRow 
              key={it.id} 
              item={it} 
              borrowedQty={(borrowedItems || []).find(b => b.item_name === it.name)?.borrowed_quantity || 0}
              onUpdate={(d) => updateBorrow(it, d)}

            />
          ))}
        </div>
      </div>
    </div>
  );
};

const BorrowItemRow = ({ item, borrowedQty, onUpdate }: { item: any, borrowedQty: number, onUpdate: (d: number) => void }) => {
  const [loading, setLoading] = useState(false);
  const handle = async (d: number) => {
    setLoading(true);
    await onUpdate(d);
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-between p-3 bg-card border rounded-xl hover:shadow-sm transition-all group">
      <div className="min-w-0 pr-2">
        <div className="text-sm font-bold truncate">{item.name}</div>
        <div className="text-[10px] text-muted-foreground whitespace-nowrap">{fmtINR(item.delivery_price || 0)} | Avail: {item.available_quantity || 0}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button 
          variant="outline" 
          size="icon" 
          className="h-7 w-7 rounded-full" 
          onClick={() => handle(-1)} 
          disabled={loading || borrowedQty <= 0}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className={`w-6 text-center font-bold text-sm ${borrowedQty > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
          {borrowedQty}
        </span>
        <Button 
          variant="outline" 
          size="icon" 
          className="h-7 w-7 rounded-full bg-primary/5 hover:bg-primary/10 border-primary/20" 
          onClick={() => handle(1)} 
          disabled={loading}
        >
          <Plus className="h-3 w-3 text-primary" />
        </Button>
      </div>
    </div>
  );
};


// --- EXISTING DIALOGS ---

const ItemTable = ({ items = [], categories = [], onEdit, onDelete, showCategory }: any) => {
  const { t } = useI18n();
  const catName = (id: number) => {
    const c = (categories || []).find((x: any) => x.id === id);
    if (!c) return "—";
    if (c.parent_id) {
      const p = categories.find((x: any) => x.id === c.parent_id);
      return p ? `${p.name} › ${c.name}` : c.name;
    }
    return c.name;
  };

  const navigate = useNavigate();

  const fmtValue = (val: any, isPrice = false) => {
    if (val === null || val === undefined || val === '') return "—";
    return isPrice ? fmtINR(val) : val;
  };

  return (
    <div className="rounded-xl border bg-card shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-5 py-3">{t("itemName")}</th>
              {showCategory && <th className="text-left px-5 py-3">{t("category")}</th>}
              <th className="text-right px-5 py-3">{t("priceTakeaway")}</th>
              <th className="text-right px-5 py-3">{t("priceDelivery")}</th>
              <th className="text-right px-5 py-3">{t("available")}</th>
              <th className="text-center px-5 py-3">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={showCategory ? 6 : 5} className="text-center text-muted-foreground py-10">{t("noItemsFound")}</td></tr>}
            {items.map((i: any) => (
              <tr key={i.id} className="border-t hover:bg-muted/30">
                <td className="px-5 py-3 font-medium">{i.name}</td>
                {showCategory && <td className="px-5 py-3 text-muted-foreground">{catName(i.category_id)}</td>}
                <td className="px-5 py-3 text-right">{fmtValue(i.takeaway_price, true)}</td>
                <td className="px-5 py-3 text-right">{fmtValue(i.delivery_price, true)}</td>
                <td className="px-5 py-3 text-right font-medium">{fmtValue(i.available_quantity)}</td>
                <td className="px-5 py-3 text-center whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(i)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(i.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ItemDialog = ({ item, categories, onClose }: any) => {
  const { t } = useI18n();
  const [name, setName] = useState(item?.name || "");
  const [categoryId, setCategoryId] = useState<string>(item?.category_id?.toString() || "none");
  const [takeawayPrice, setTakeawayPrice] = useState<string>(item?.takeaway_price != null ? item.takeaway_price.toString() : "");
  const [deliveryPrice, setDeliveryPrice] = useState<string>(item?.delivery_price != null ? item.delivery_price.toString() : "");
  const [availableQty, setAvailableQty] = useState<string>(item?.available_quantity != null ? item.available_quantity.toString() : "");

  const save = async () => {
    if (!name) return toast.error("Item Name is required");
    
    const payload = {
      name,
      category_id: categoryId === "none" ? null : Number(categoryId),
      takeaway_price: takeawayPrice === "" ? null : Number(takeawayPrice),
      delivery_price: deliveryPrice === "" ? null : Number(deliveryPrice),
      available_quantity: availableQty === "" ? null : Number(availableQty)
    };

    try {
      if (item) {
        await api.updateItem(item.id, payload);
        toast.success("Item updated");
      } else {
        await api.createItem(payload);
        toast.success("Item added");
      }
      onClose();
    } catch (err) {
      toast.error("Failed to save item");
    }
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle className="text-xl font-bold">{item ? t("editItem") : t("addItem")}</DialogTitle></DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-1">
          <Label>{t("itemName")} *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("itemName")} />
        </div>

        <div className="space-y-1">
          <Label>{t("category")}</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder={t("select")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("none")}</SelectItem>
              {(categories || []).map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>{t("priceTakeaway")}</Label>
            <Input 
              type="number" 
              inputMode="numeric" 
              value={takeawayPrice} 
              onChange={(e) => setTakeawayPrice(e.target.value)} 
              placeholder="0" 
            />
          </div>
          <div className="space-y-1">
            <Label>{t("priceDelivery")}</Label>
            <Input 
              type="number" 
              inputMode="numeric" 
              value={deliveryPrice} 
              onChange={(e) => setDeliveryPrice(e.target.value)} 
              placeholder="0" 
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label>{t("available")}</Label>
          <Input 
            type="number" 
            inputMode="numeric" 
            min={0}
            value={availableQty} 
            onChange={(e) => setAvailableQty(e.target.value)} 
            placeholder="0" 
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
        <Button onClick={save} className="bg-primary hover:bg-primary/90 font-bold">{t("save")}</Button>
      </DialogFooter>
    </DialogContent>
  );
};

const CategoryDialog = ({ category, onClose }: any) => {
  const { t } = useI18n();
  const [name, setName] = useState(category?.name || "");

  const save = async () => {
    if (!name) return toast.error("Category Name is required");
    try {
      if (category) {
        await api.updateCategory(category.id, { name });
        toast.success("Category updated");
      } else {
        await api.createCategory({ name });
        toast.success("Category added");
      }
      onClose();
    } catch (err) {
      toast.error("Failed to save category");
    }
  };

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader><DialogTitle className="text-xl font-bold">{category ? t("editCategory") : t("addCategory")}</DialogTitle></DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-1">
          <Label>{t("category")} {t("name")} *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chairs, Tents" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
        <Button onClick={save} className="bg-primary hover:bg-primary/90 font-bold">{t("save")}</Button>
      </DialogFooter>
    </DialogContent>
  );
};

const BorrowerDialog = ({ isOpen, borrower, onClose }: { isOpen: boolean, borrower: any, onClose: () => void }) => {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (borrower && isOpen) {
      setName(borrower.name);
      setPhone(borrower.phone || "");
      setNotes(borrower.notes || "");
    } else {
      setName(""); setPhone(""); setNotes("");
    }
  }, [borrower, isOpen]);

  const save = async () => {
    if (!name || !phone) return toast.error("Name and Phone are required");
    setLoading(true);
    try {
      if (borrower) {
        await api.updateVendor(borrower.id, { name, phone, notes });
        toast.success("Updated");
      } else {
        await api.createVendor({ name, phone, notes });
        toast.success("Created");
      }
      onClose();
    } catch (err: any) {
      toast.error("Save failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{borrower ? t("editBorrower") : t("addBorrower")}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1.5"><Label>{t("borrowerName")} *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Enter name" /></div>
          <div className="space-y-1.5"><Label>{t("phone")} *</Label><Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" /></div>
          <div className="space-y-1.5"><Label>{t("notes")}</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional details..." className="resize-none h-24" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>{t("cancel")}</Button>
          <Button onClick={save} disabled={loading} className="font-bold">{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Inventory;
