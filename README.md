# Yapılacaklar Listesi (Todo App)

HTML, CSS ve Vanilla JavaScript ile yapılmış, **Supabase** (PostgreSQL) veritabanına REST API üzerinden bağlanan basit bir todo uygulaması.

## Özellikler
- 🔐 E-posta + şifre ile kayıt ve giriş (e-posta onayı gerekmez)
- 👤 Her kullanıcı yalnızca kendi görevlerini görür (RLS ile)
- ✏️ Görev düzenleme (metne çift tıkla veya kalem ikonu)
- 📅 Son tarih (deadline) — geçmiş tarihler kırmızı uyarı
- ↕️ Sürükle-bırak ile öncelik sıralaması (sıra kalıcı kaydedilir)
- 🔍 Görevlerde anlık arama
- 🌗 Açık / koyu tema (tercih kaydedilir)
- ➕ Görev ekleme
- ✅ Tamamlandı / aktif işaretleme
- 🗑️ Silme ve tamamlananları temizleme
- 🔍 Filtreler: Tümü / Aktif / Tamamlanan
- ☁️ Supabase ile kalıcı, çoklu cihaz senkronizasyonu
- 📱 Responsive koyu tema

## Teknolojiler
- HTML / CSS / JavaScript (framework yok)
- Supabase REST API (`/rest/v1/todos`)

## Çalıştırma
Statik bir dosya olduğu için doğrudan `index.html` açılabilir veya basit bir sunucu ile servis edilebilir:

```bash
python -m http.server 5500
```

Ardından http://localhost:5500 adresine gidin.

## Güvenlik
Yalnızca Supabase **anon key** istemciye gömülüdür ve Row Level Security (RLS) ile korunmaktadır.
