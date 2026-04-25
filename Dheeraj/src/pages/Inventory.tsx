import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search, AlertTriangle, Camera } from "lucide-react";
import { fmtINR } from "@/lib/format";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const Inventory = () => {
  const { t } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [openItem, setOpenItem] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [openCategory, setOpenCategory] = useState(false);
  const [editCategory, setEditCategory] = useState<any>(null);

  const load = async () => {
    const [it, cat] = await Promise.all([
      api.getItems(),
      api.getCategories(),
    ]);
    setItems(it || []); 
    setCategories(cat || []);
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter((i) => 
    !search || 
    i.name.toLowerCase().includes(search.toLowerCase())
  );
  
  const lowStock = items.filter((i) => i.available_quantity !== null && i.available_quantity <= (i.low_stock_threshold || 0));

  const removeItem = async (id: number) => {
    if (!confirm(`Delete this item? This cannot be undone.`)) return;
    try {
      await api.deleteItem(id);
      toast.success("Item deleted");
      load();
    } catch (err) {
      toast.error("Failed to delete item");
    }
  };

  const removeCategory = async (id: number) => {
    if (!confirm(`Delete this category? Items within this category will become Non-Category Items.`)) return;
    try {
      await api.deleteCategory(id);
      toast.success("Category deleted");
      load();
    } catch (err) {
      toast.error("Failed to delete category");
    }
  };

  const categoryItems = filtered.filter((i) => i.category_id !== null);
  const nonCategoryItems = filtered.filter((i) => i.category_id === null);

  return (
    <>
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

      {lowStock.length > 0 && (
        <div className="mb-6 rounded-lg border border-warning/30 bg-warning/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
          <div>
            <div className="font-medium">{lowStock.length} {t("lowStockWarning")}</div>
            <div className="text-sm text-muted-foreground mt-1">{lowStock.map(i => i.name).join(", ")}</div>
          </div>
        </div>
      )}

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")} className="pl-9" />
      </div>

      <div className="space-y-10">
        {categories.map(c => {
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

        {categories.filter(c => filtered.filter(i => i.category_id === c.id).length === 0).map(c => (
          <section key={c.id} className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-xl font-bold text-muted-foreground">{c.name} (Empty)</h2>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditCategory(c)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => removeCategory(c.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="p-4 bg-muted/20 text-center text-sm text-muted-foreground rounded-lg border border-dashed">No items in this category.</div>
          </section>
        ))}

        {(nonCategoryItems.length > 0) && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold border-b pb-2">{t("nonCategoryItem")}</h2>
            <ItemTable items={nonCategoryItems} categories={categories} onEdit={setEditItem} onDelete={removeItem} showCategory={false} />
          </section>
        )}
      </div>
    </>
  );
};

const ItemTable = ({ items, categories, onEdit, onDelete, showCategory }: any) => {
  const { t } = useI18n();
  const catName = (id: number) => {
    const c = categories.find((x: any) => x.id === id);
    if (!c) return "—";
    if (c.parent_id) {
      const p = categories.find((x: any) => x.id === c.parent_id);
      return p ? `${p.name} › ${c.name}` : c.name;
    }
    return c.name;
  };

  const navigate = useNavigate();

  const openPhotos = async (itemId: number) => {
    try {
      const { album } = await api.getInventoryAlbum(itemId);
      navigate(`/gallery/album/${album.id}`);
    } catch (err) {
      toast.error("Failed to open photos");
    }
  };

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
                  <Button variant="ghost" size="sm" onClick={() => openPhotos(i.id)} title="Item Photos"><Camera className="h-3.5 w-3.5" /></Button>
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
              {categories.map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
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

const CategoryDialog = ({ category, categories, onClose }: any) => {
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

export default Inventory;
