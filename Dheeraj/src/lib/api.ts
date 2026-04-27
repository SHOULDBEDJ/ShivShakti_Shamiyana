export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = {
  // Customers
  async searchCustomers(query: string) {
    const res = await fetch(`${API_BASE_URL}/customers/search?query=${encodeURIComponent(query)}`, { cache: 'no-store' });
    return res.json();
  },
  async createCustomer(data: { name: string; phone: string; place?: string }) {
    const res = await fetch(`${API_BASE_URL}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async generateCustomerID() {
    const res = await fetch(`${API_BASE_URL}/generate/customer-id`, { cache: 'no-store' });
    return res.json();
  },

  // Bookings
  async generateBookingID() {
    const res = await fetch(`${API_BASE_URL}/generate/booking-id`, { cache: 'no-store' });
    return res.json();
  },
  async getBookings(search = '', status = 'all') {
    const res = await fetch(`${API_BASE_URL}/bookings?search=${encodeURIComponent(search)}&status=${status}`, { cache: 'no-store' });
    return res.json();
  },
  async getBooking(id: string) {
    const res = await fetch(`${API_BASE_URL}/bookings/${id}`, { cache: 'no-store' });
    return res.json();
  },
  async createBooking(formData: FormData) {
    const res = await fetch(`${API_BASE_URL}/bookings`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },
  async updateStatus(id: string, status: string) {
    const res = await fetch(`${API_BASE_URL}/bookings/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return res.json();
  },
  async addPayment(id: string, data: { amount: number; method: string }) {
    const res = await fetch(`${API_BASE_URL}/bookings/${id}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async processReturn(id: string, data: { 
    items: any[]; 
    payment_amount: number; 
    payment_method: string; 
    discount_amount?: number; 
    missing_total?: number; 
    final_payable?: number 
  }) {
    const res = await fetch(`${API_BASE_URL}/bookings/${id}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async deleteBooking(id: string) {
    const res = await fetch(`${API_BASE_URL}/bookings/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async getPayments() {
    const res = await fetch(`${API_BASE_URL}/payments`, { cache: 'no-store' });
    return res.json();
  },

  // Order Links & Public Orders
  async generateOrderLink() {
    const res = await fetch(`${API_BASE_URL}/order-links`, {
      method: 'POST',
    });
    return res.json();
  },
  async getOrderLinks() {
    const res = await fetch(`${API_BASE_URL}/order-links`, { cache: 'no-store' });
    return res.json();
  },
  async validateOrderLink(token: string) {
    const res = await fetch(`${API_BASE_URL}/public-orders/validate/${token}`, { cache: 'no-store' });
    return res.json();
  },
  async submitPublicOrder(token: string, data: any) {
    const res = await fetch(`${API_BASE_URL}/public-orders/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async checkPublicOrderStatus(token: string) {
    const res = await fetch(`${API_BASE_URL}/public-orders/status/${token}`, { cache: 'no-store' });
    return res.json();
  },


  // Inventory: Categories
  async getCategories() {
    const res = await fetch(`${API_BASE_URL}/inventory/categories`, { cache: 'no-store' });
    return res.json();
  },
  async createCategory(data: any) {
    const res = await fetch(`${API_BASE_URL}/inventory/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async updateCategory(id: number | string, data: any) {
    const res = await fetch(`${API_BASE_URL}/inventory/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async deleteCategory(id: number | string) {
    const res = await fetch(`${API_BASE_URL}/inventory/categories/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  // Inventory: Items
  async getItems() {
    const res = await fetch(`${API_BASE_URL}/inventory/items`, { cache: 'no-store' });
    return res.json();
  },
  async getNonCategoryItems() {
    const res = await fetch(`${API_BASE_URL}/inventory/items/non-category`, { cache: 'no-store' });
    return res.json();
  },
  async createItem(data: any) {
    const res = await fetch(`${API_BASE_URL}/inventory/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async updateItem(id: number | string, data: any) {
    const res = await fetch(`${API_BASE_URL}/inventory/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async deleteItem(id: number | string) {
    const res = await fetch(`${API_BASE_URL}/inventory/items/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },
  async checkAvailability(id: number | string, quantity: number) {
    const res = await fetch(`${API_BASE_URL}/inventory/items/${id}/availability?quantity=${quantity}`, { cache: 'no-store' });
    return res.json();
  },

  // Vendors
  async getVendors() {
    const res = await fetch(`${API_BASE_URL}/vendors`, { cache: 'no-store' });
    return res.json();
  },

  async createVendor(data: any) {
    const res = await fetch(`${API_BASE_URL}/vendors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async updateVendor(id: number | string, data: any) {
    const res = await fetch(`${API_BASE_URL}/vendors/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async deleteVendor(id: number | string) {
    const res = await fetch(`${API_BASE_URL}/vendors/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  // Vendor Borrows & Returns
  async getVendorBorrows(vendorId: number | string) {
    const res = await fetch(`${API_BASE_URL}/vendors/${vendorId}/borrows`, { cache: 'no-store' });
    return res.json();
  },
  async updateVendorReturn(borrowId: number | string, data: { return_quantity: number; amount_paid: number }) {
    const res = await fetch(`${API_BASE_URL}/vendors/borrows/${borrowId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async getVendorPayments(vendorId: number | string) {
    const res = await fetch(`${API_BASE_URL}/vendors/${vendorId}/payments`, { cache: 'no-store' });
    return res.json();
  },
  async createManualBorrow(data: { vendor_id: number; item_name: string; item_id?: number | string; quantity: number }) {
    const res = await fetch(`${API_BASE_URL}/vendors/borrows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteBorrow(id: number | string) {
    const res = await fetch(`${API_BASE_URL}/vendors/borrows/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },


  // Settings: Function Types
  async getFunctionTypes() {
    const res = await fetch(`${API_BASE_URL}/settings/function-types`, { cache: 'no-store' });
    return res.json();
  },
  async createFunctionType(name: string) {
    const res = await fetch(`${API_BASE_URL}/settings/function-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async updateFunctionType(id: number | string, name: string) {
    const res = await fetch(`${API_BASE_URL}/settings/function-types/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async deleteFunctionType(id: number | string) {
    const res = await fetch(`${API_BASE_URL}/settings/function-types/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  // Settings: Data Management
  async backupData() {
    const res = await fetch(`${API_BASE_URL}/settings/backup`, { cache: 'no-store' });
    return res.json();
  },
  async restoreData(data: any) {
    const res = await fetch(`${API_BASE_URL}/settings/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
    return res.json();
  },
  async deleteAllData(token: string) {
    const res = await fetch(`${API_BASE_URL}/settings/delete-all`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: token }),
    });
    return res.json();
  },

  // Gallery: Albums
  async getAlbums(params: any = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE_URL}/gallery/albums?${query}`, { cache: 'no-store' });
    return res.json();
  },
  async createAlbum(data: any) {
    const res = await fetch(`${API_BASE_URL}/gallery/albums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async updateAlbum(id: number | string, data: any) {
    const res = await fetch(`${API_BASE_URL}/gallery/albums/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async deleteAlbum(id: number | string) {
    const res = await fetch(`${API_BASE_URL}/gallery/albums/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  // Gallery: Photos
  async getAlbumPhotos(albumId: number | string) {
    const res = await fetch(`${API_BASE_URL}/gallery/albums/${albumId}/photos`, { cache: 'no-store' });
    return res.json();
  },
  async uploadPhotos(albumId: number | string, formData: FormData) {
    const res = await fetch(`${API_BASE_URL}/gallery/albums/${albumId}/photos`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("Upload photos failed:", text);
      throw new Error(text);
    }
    return res.json();
  },
  async updatePhoto(id: number | string, data: any) {
    const res = await fetch(`${API_BASE_URL}/gallery/photos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async deletePhoto(id: number | string) {
    const res = await fetch(`${API_BASE_URL}/gallery/photos/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },
  async deletePhotosBulk(photoIds: number[]) {
    const res = await fetch(`${API_BASE_URL}/gallery/photos/bulk`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_ids: photoIds }),
    });
    return res.json();
  },
  async movePhotos(photoIds: number[], targetAlbumId: number) {
    const res = await fetch(`${API_BASE_URL}/gallery/photos/move`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_ids: photoIds, target_album_id: targetAlbumId }),
    });
    return res.json();
  },
  async getBookingAlbum(bookingId: string) {
    const res = await fetch(`${API_BASE_URL}/gallery/booking/${bookingId}/album`, { cache: 'no-store' });
    return res.json();
  },
  async getInventoryAlbum(itemId: number | string) {
    const res = await fetch(`${API_BASE_URL}/gallery/inventory/${itemId}/album`, { cache: 'no-store' });
    return res.json();
  },

  // Business Profile
  async getBusinessProfile() {
    const res = await fetch(`${API_BASE_URL}/settings/business-profile`, { cache: 'no-store' });
    return res.json();
  },
  async updateBusinessProfile(formData: FormData) {
    const res = await fetch(`${API_BASE_URL}/settings/business-profile`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("Update profile failed:", text);
      throw new Error(text);
    }
    return res.json();
  },

  // Reports
  async getMonthlyReport(month: string, year: string) {
    const res = await fetch(`${API_BASE_URL}/reports/monthly?month=${month}&year=${year}`, { cache: 'no-store' });
    return res.json();
  },
  async getDailyReport(date: string) {
    const res = await fetch(`${API_BASE_URL}/reports/daily?date=${date}`, { cache: 'no-store' });
    return res.json();
  },
  async getPendingPaymentsReport() {
    const res = await fetch(`${API_BASE_URL}/reports/pending-payments`, { cache: 'no-store' });
    return res.json();
  },
  async getBookingStatusReport(from: string, to: string, status: string) {
    const res = await fetch(`${API_BASE_URL}/reports/booking-status?from=${from}&to=${to}&status=${status}`, { cache: 'no-store' });
    return res.json();
  },
  async getVendorBorrowsReport(vendorId: string, from: string, to: string) {
    const res = await fetch(`${API_BASE_URL}/reports/vendor-borrows?vendor_id=${vendorId}&from=${from}&to=${to}`, { cache: 'no-store' });
    return res.json();
  },

  // Staff (Workers)
  async getWorkers() {
    const res = await fetch(`${API_BASE_URL}/workers`, { cache: 'no-store' });
    return res.json();
  },
  async createWorker(data: any) {
    const res = await fetch(`${API_BASE_URL}/workers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async updateWorker(id: string | number, data: any) {
    const res = await fetch(`${API_BASE_URL}/workers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async deleteWorker(id: string | number) {
    const res = await fetch(`${API_BASE_URL}/workers/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  // Expenses
  async getExpenses() {
    const res = await fetch(`${API_BASE_URL}/expenses`, { cache: 'no-store' });
    return res.json();
  },
  async createExpense(data: any) {
    const res = await fetch(`${API_BASE_URL}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async deleteExpense(id: string | number) {
    const res = await fetch(`${API_BASE_URL}/expenses/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },
  async getExpenseTypes() {
    const res = await fetch(`${API_BASE_URL}/settings/expense-types`, { cache: 'no-store' });
    return res.json();
  },
  async createExpenseType(name: string) {
    const res = await fetch(`${API_BASE_URL}/settings/expense-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return res.json();
  },
  async updateExpenseType(id: number | string, name: string) {
    const res = await fetch(`${API_BASE_URL}/settings/expense-types/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return res.json();
  },
  async deleteExpenseType(id: number | string) {
    const res = await fetch(`${API_BASE_URL}/settings/expense-types/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },


  // Profile
  async getProfile() {
    const res = await fetch(`${API_BASE_URL}/profile`, { cache: 'no-store' });
    return res.json();
  },
  async updateProfile(data: any) {
    const res = await fetch(`${API_BASE_URL}/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("Upload file failed:", text);
      throw new Error(text);
    }
    return res.json();
  },
};
