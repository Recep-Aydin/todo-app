# Yapılacaklar Listesi (Todo App)

HTML, CSS ve Vanilla JavaScript ile yapılmış, **Supabase** (PostgreSQL) veritabanına REST API üzerinden bağlanan basit bir todo uygulaması.

## Özellikler
- 🔐 E-posta + şifre ile kayıt ve giriş (e-posta onayı gerekmez)
- 👤 Her kullanıcı yalnızca kendi görevlerini görür (RLS ile)
- 🚦 Öncelik etiketleri (Yüksek/Orta/Düşük — kırmızı/sarı/yeşil, noktaya tıkla değiştir)
- 📊 Günlük ilerleme çubuğu (tamamlanan % — %100'de yeşil)
- 🎉 Görev tamamlanınca konfeti animasyonu
- 🎮 XP & seviye sistemi (görev başına +10 XP, geri alınca −10)
- 🎖️ Rozet vitrini (İlk Adım, Üretken, Seri, Yüz Puan, Usta, Efsane…)
- ⚔️ Günlük Kapışma: tüm kullanıcıların yarıştığı canlı liderlik tablosu (kim çok görev yaparsa öne geçer)
- ✏️ Görev düzenleme (metne çift tıkla veya kalem ikonu)
- 📅 Son tarih (deadline) — geçmiş tarihler kırmızı uyarı
- ↕️ Sürükle-bırak ile öncelik sıralaması (sıra kalıcı kaydedilir)
- 🔁 Tekrarlayan görevler (Her gün / Hafta içi / Hafta sonu) — tamamlanınca sonraki güne otomatik planlanır
- 🔍 Görevlerde anlık arama
- 🌗 Açık / koyu tema (tercih kaydedilir)
- 🛠️ **Mühendis Köşesi** yan paneli: günün mühendislik terimi + tıklayınca eklenen hazır mini görevler
- 🔬 **Bilim Dünyası** köşesi: Spaceflight News API'den güncel uzay & bilim haberleri (canlı)
- 📓 **Günlük Ajanda** (sol panel): her güne özel not/ajanda, otomatik kayıt, ◀ ▶ ile geçmiş günleri gez
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
