import React, { useEffect, useState, forwardRef } from 'react';
import { api, API_BASE_URL } from '@/lib/api';

import { useI18n } from '@/context/I18nContext';

interface InvoicePreviewProps {
  booking: any;
}

export const InvoicePreview = forwardRef<HTMLDivElement, InvoicePreviewProps>(({ booking }, ref) => {
  const { t } = useI18n();
  const [profile, setProfile] = useState<any>({});

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.getBusinessProfile();
      setProfile(data || {});
    } catch (err) {
      console.error("Failed to load business profile", err);
    }
  };

  const bookingDate = new Date(booking.booking_date).toLocaleDateString('en-GB'); // DD/MM/YYYY
  
  // Ensure we have at least 13 rows
  const MIN_ROWS = 13;
  const items = booking.items || [];
  const rows = [...items];
  while (rows.length < MIN_ROWS) {
    rows.push({ isBlank: true, item_id: Math.random().toString() });
  }

  return (
    <div 
      ref={ref}
      className="bg-white text-black p-4 shadow-xl mx-auto overflow-hidden" 
      style={{ 
        width: '800px', // Fixed width for consistent capture
        minHeight: '1130px', // Fixed height for A4 ratio
        fontFamily: "'Noto Sans Kannada', sans-serif",
        boxSizing: 'border-box',
      }}
    >
      <div className="border border-black p-1 sm:p-2 h-full flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between mb-4 border-b border-black pb-2">
          {/* Logo / Deity Image */}
          <div className="w-[80px] h-[80px] flex-shrink-0 border border-black flex items-center justify-center bg-gray-50 overflow-hidden">
            {profile.photo_url ? (
              <img src={profile.photo_url} alt="Logo" className="w-full h-full object-contain" />
            ) : profile.deity_image_path ? (
              <img src={`${API_BASE_URL.replace('/api', '')}/${profile.deity_image_path}`} alt="Deity" className="w-full h-full object-contain grayscale" />
            ) : (
              <span className="text-[10px] text-gray-400">LOGO</span>
            )}
          </div>

          {/* Center Titles */}
          <div className="flex-1 text-center px-4">
            <div className="text-sm font-bold">{profile.blessing_kn || '|| ಶ್ರೀ ಜಗದಂಬಾ ಪ್ರಸನ್ನ ||'}</div>
            <div className="text-3xl font-extrabold mt-1 mb-1 leading-none">{profile.name_kn || 'ಶಿವಶಕ್ತಿ ಶಾಮಿಯಾನ'}</div>
            <div className="text-sm leading-tight max-w-sm mx-auto">
              {profile.address1_kn && <div>{profile.address1_kn}</div>}
              {profile.address2_kn && <div>{profile.address2_kn}</div>}
              {profile.address3_kn && <div>{profile.address3_kn}</div>}
            </div>
          </div>

          {/* Right Phones */}
          <div className="text-right text-[13px] font-bold whitespace-nowrap pt-2 pr-1 space-y-0.5">
            <div className="flex items-center justify-end gap-1">
               <span className="text-[10px] font-normal">Mob:</span> {profile.phone || profile.phone1 || '9110000000'}
            </div>
            {profile.phone2 && <div>{profile.phone2}</div>}
            {profile.phone3 && <div>{profile.phone3}</div>}
          </div>
        </div>

        {/* Booking Info */}
        <div className="flex justify-between items-center mb-2 px-2 text-sm font-bold">
          <div>{t("no")}. {booking.booking_id}</div>
          <div className="flex items-center gap-2">
            {t("date")} : <span className="border-b border-black inline-block w-32 text-center">{bookingDate}</span>
          </div>
        </div>

        <div className="flex mb-4 px-2 text-sm font-bold">
          <div className="mr-2 whitespace-nowrap">{t("mrs_mr")}</div>
          <div className="border-b border-black flex-1 leading-snug">{booking.customer_name}</div>
        </div>

        {/* Items Table */}
        <table className="w-full border-collapse border border-black text-sm mb-8 flex-1">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-black p-1 w-10 text-center">{t("slNo")}</th>
              <th className="border border-black p-1 text-left">{t("categoryItem")}</th>
              <th className="border border-black p-1 w-20 text-center">{t("qty")}</th>
              <th className="border border-black p-1 w-24 text-right pr-2">{t("total")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item: any, index: number) => (
              <tr key={item.item_id || index}>
                <td className="border border-black p-0.5 text-center h-[24px] text-xs">{index + 1}</td>
                <td className="border border-black p-0.5 px-2 text-xs">{item.isBlank ? '' : item.item_name}</td>
                <td className="border border-black p-0.5 text-center text-xs">{item.isBlank ? '' : item.quantity}</td>
                <td className="border border-black p-0.5 text-right pr-2 text-xs">{item.isBlank ? '' : item.subtotal?.toFixed(2)}</td>
              </tr>
            ))}

            {booking.pricing_mode === 'delivery' && (Number(booking.delivery_charge) || 0) > 0 && (
              <tr>
                <td className="border border-black p-1" colSpan={2}></td>
                <td className="border border-black p-1 text-center font-bold">{t("deliveryCharge")}</td>
                <td className="border border-black p-1 text-right pr-2 font-bold">{Number(booking.delivery_charge).toFixed(2)}</td>
              </tr>
            )}

            <tr>
              <td className="border border-black p-1" colSpan={2}></td>
              <td className="border border-black p-1 text-center font-bold">{t("total")}</td>
              <td className="border border-black p-1 text-right pr-2 font-bold">{booking.total_amount?.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div className="flex justify-between items-end px-4 mt-auto mb-4">
          <div className="text-center">
            <div className="w-32 border-b border-black mb-1"></div>
            <div className="text-sm">{t("giverSignature")}</div>
          </div>
          <div className="text-center">
            <div className="w-32 border-b border-black mb-1"></div>
            <div className="text-sm">{t("receiverSignature")}</div>
          </div>
        </div>
      </div>
    </div>
  );
});

InvoicePreview.displayName = 'InvoicePreview';
