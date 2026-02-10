# Kinetic Roast - Kahve Şirketi Uygulaması PRD

## Genel Bakış
Expo React Native ve FastAPI ile geliştirilmiş, menü, sipariş, sadakat programı, şube bulucu, bildirimler ve kapsamlı admin paneli içeren premium kahve şirketi mobil uygulaması. Tüm arayüz Türkçe.

## Teknoloji
- **Frontend**: Expo SDK 54, React Native, expo-router
- **Backend**: FastAPI (Python), MongoDB (motor async driver)
- **Müşteri Auth**: Emergent Google OAuth
- **Admin Auth**: Email/Şifre (SHA256 hash)

## Müşteri Özellikleri
- Türkçe hoş geldin ekranı + Google Auth / Misafir girişi
- Ana sayfa: Puan kartı, hızlı erişim, popüler ürünler, kampanyalar, promosyon banner
- Menü: Kategori filtreli (Espresso, Latte, Soğuk İçecekler, Atıştırmalık) - 11 ürün, TL fiyatlar
- Ürün detay: Boyut/adet seçimi + sepete ekle
- Sepet: Şube seçimi + sipariş verme (₺1 = 10 puan)
- Sadakat: Bronz → Gümüş → Altın seviye, 5 ödül
- Şube bulucu: 4 İstanbul lokasyonu (Kadıköy, Beşiktaş, Nişantaşı, Bağdat Caddesi)
- Profil: Sipariş geçmişi, QR kodum
- Bildirimler

## Admin Paneli (admin@kineticr.com / admin123)
- **Genel Bakış**: Müşteri/sipariş/gelir/menü/şube/kampanya istatistikleri
- **Menü Yönetimi**: Ürün ekle/sil (CRUD)
- **Kampanya Yönetimi**: Yüzde veya sabit indirimli kampanya oluştur/sil
- **Toplu Bildirim**: Tüm kullanıcılara bildirim gönder
- **QR Kod Tarayıcı**: Müşteri QR kodu okut → puan ekle
- **Şube Yönetimi**: Şube ekle/sil (adres, saat, telefon)
- **Şube Yetkilileri**: Yeni şube yöneticisi hesabı oluştur/sil
- **Sipariş Yönetimi**: Durum güncelle (Onaylandı/Hazırlanıyor/Hazır/Tamamlandı/İptal)
- **Ödül Yönetimi**: Ödül ekle/sil
- **Müşteri Listesi**: Tüm kullanıcıları görüntüle

## API Endpoints (30+)
Müşteri: /api/menu, /api/stores, /api/rewards, /api/orders, /api/notifications, /api/campaigns, /api/my-qr, /api/auth/*
Admin: /api/admin/login, /api/admin/stats, /api/admin/menu/*, /api/admin/campaigns/*, /api/admin/stores/*, /api/admin/managers/*, /api/admin/orders/*, /api/admin/rewards/*, /api/admin/users, /api/admin/notifications/send, /api/admin/add-points

## İş Geliştirme Önerisi
"Kinetic Pass" aylık abonelik (₺149/ay): Sınırsız orta boy içecek + 2x puan + sezonluk ürünlere erken erişim — tekrarlayan gelir ve müşteri bağlılığı.
