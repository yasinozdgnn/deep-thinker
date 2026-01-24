# GLM Deep Thinking MCP - Gelişmiş Coder Agent

Cursor IDE için GLM-4.7 Deep Thinking modunu aktifleştiren, **50+ gelişmiş araç** ve **otomatik düzeltme** yetenekleri içeren MCP (Model Context Protocol) sunucusu.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

## Neden Bu Proje?

Cursor kullanırken API key ile GLM modellerini kullandığımda, Deep Thinking özelliğinin aslında çalışmadığını fark ettim. Model tam kapasitesiyle kullanılamıyordu.

**Sorunlar:**
- Cursor'da GLM Deep Thinking modu varsayılan olarak aktif değil
- API üzerinden `thinking` parametresi gönderilmiyor
- Büyük projelerde modelin derin analiz kapasitesi kullanılamıyor

**Çözüm:**
Bu MCP sunucusu ile GLM modelinin Deep Thinking özelliğini tam olarak aktifleştiriyoruz. GLM'i Cursor içinde **ikinci bir AI agent** olarak kullanarak maliyetleri düşürüp, derin düşünme yeteneklerinden faydalanabilirsiniz.

**Neden GLM?**
- Açık kaynak modeller arasında en güçlülerinden biri
- Deep Thinking modu ile karmaşık kodlama görevlerinde üstün performans
- Claude/GPT'ye kıyasla ağır işler için daha düşük maliyet
- Yerel MCP sunucusu ile güvenli kullanım

---

## Temel Özellikler

### 4 Aşamalı Derin Düşünme Sistemi

GLM profesyonel bir coder agent iş akışıyla çalışır:

| Aşama | Açıklama |
|-------|----------|
| **Phase 1: Sorun Öngörümü** | Kod yazmadan ÖNCE edge case'leri, hata senaryolarını, race condition'ları, güvenlik endişelerini ve performans sorunlarını proaktif olarak tespit eder |
| **Phase 2: Defansif Kodlama** | Tespit edilen tüm sorunları handle eden, uygun hata yönetimi ve input validasyonu içeren kod yazar |
| **Phase 3: Self-Review** | Kendi kodunu doğruluk, edge case'ler, hata yönetimi, kod kalitesi ve güvenlik açısından inceler |
| **Phase 4: Syntax Doğrulama** | Dengeli parantezler, noktalı virgüller, import'lar ve uygun indentation ile söz dizimi açısından doğru kod sağlar |

### AI Destekli Araç Seçimi (auto_detect)

Araç isimlerini hatırlamana gerek yok! Sadece ne istediğini açıkla:

```
glm-deepthinker kullan: bu kodu performans için optimize et
```

`auto_detect` tool'u isteğini otomatik analiz eder ve en uygun aracı seçer:
- "bug bul" → `find_bugs`
- "güvenlik kontrolü" → `security_scan`
- "hızlandır" → `optimize_code`
- "açıkla" → `explain_code`

### Otomatik Düzeltme Araçları

Bu araçlar sorunları analiz edip OTOMATİK OLARAK düzeltir, ardından dosyayı günceller:

| Araç | Eylem |
|------|-------|
| `find_bugs` | Bug'ları tespit eder ve otomatik düzeltir |
| `optimize_code` | Performans sorunlarını tespit eder ve optimizasyonları uygular |
| `security_scan` | OWASP Top 10 taraması yapar ve güvenlik açıklarını kapatır |

### 50+ Mevcut Araç

<details>
<summary>Tam araç listesi için tıklayın</summary>

#### Core Araçlar (3)
- `deep_think_chat` - Karmaşık sorular için derin düşünme
- `deep_think_verbose` - Görünür akıl yürütme süreciyle derin düşünme
- `deep_think_code` - Kod oluştur ve dosyaya kaydet

#### Dosya İşlemleri (4)
- `read_file`, `write_file`, `list_directory`, `search_in_files`

#### Kod Analizi & Otomatik Düzeltme (6)
- `refactor_code` - Refactor et ve kaydet
- `explain_code` - Açıklama oluştur
- `add_comments` - Satır içi yorum ekle
- `find_bugs` - Bug'ları **otomatik düzelt**
- `optimize_code` - Performans sorunlarını **otomatik düzelt**
- `find_references` - Sembol kullanımlarını bul

#### Git İşlemleri (6)
- `git_diff_explain`, `generate_commit_message`
- `resolve_conflicts`, `branch_analyzer`, `pr_review`, `git_history`

#### Test & Dokümantasyon (6)
- `generate_tests`, `generate_docs`, `create_readme`
- `generate_e2e_tests`, `test_coverage_analysis`, `mock_generator`, `load_test_script`

#### CI/CD & DevOps (4)
- `generate_dockerfile`, `generate_github_actions`, `k8s_manifest`, `terraform_module`

#### Veritabanı Araçları (4)
- `analyze_query`, `explain_schema`, `suggest_indexes`, `review_migration`

#### Güvenlik & SAST (4)
- `security_scan` - Güvenlik açıklarını **otomatik düzelt**
- `dependency_audit`, `secrets_scanner`, `api_security`

#### Performans & Optimizasyon (4)
- `bundle_analysis`, `memory_leak_detect`, `api_response_time`, `caching_strategy`

#### API & Dokümantasyon (4)
- `openapi_spec`, `api_client_generator`, `graphql_schema`, `api_migration`

#### Proje Stratejisi (4)
- `architecture_review`, `tech_stack_migration`, `scaling_strategy`, `cost_optimization`

#### Proje Yönetimi (2)
- `create_project`, `add_dependency`

</details>

---

## Mimari: Çift Agent Sistemi

```
┌─────────────────────────────────────────────┐
│                CURSOR IDE                    │
├─────────────────────────────────────────────┤
│                                              │
│  ┌─────────────────┐   ┌─────────────────┐  │
│  │  Claude/GPT     │◄──┤  GLM-DeepThinker│  │
│  │  (Ana Agent)    │MCP│  (Coder Agent)  │  │
│  │                 │   │                 │  │
│  │  • Orkestrasyon │   │  • Derin Düşün  │  │
│  │  • UI kontrol   │   │  • Oto-düzelt   │  │
│  │  • Hızlı düzen  │   │  • Güvenlik     │  │
│  │                 │   │  • Optimize     │  │
│  └─────────────────┘   └─────────────────┘  │
│                                              │
└─────────────────────────────────────────────┘
```

**Maliyet Optimizasyonu:**
- Cursor agent'ını orkestrasyon ve basit görevler için kullan
- Ağır düşünmeyi (refactoring, güvenlik taramaları, derin analiz) GLM'e delege et
- Cursor abonelik limitlerini hızlı etkileşimler için sakla

---

## Kurulum

### 1. Repository'yi Klonlayın

```bash
git clone https://github.com/yasinelbuz/glm-think-mcp.git
cd glm-think-mcp
```

### 2. Bağımlılıkları Yükleyin

```bash
npm install
```

### 3. GLM API Key Alın

1. [api.z.ai](https://api.z.ai) adresine gidin
2. Hesap oluşturun veya giriş yapın
3. API Keys bölümünden yeni bir key oluşturun
4. Key'i kopyalayın

### 4. Cursor'a MCP Sunucusunu Ekleyin

1. Cursor'ı açın
2. `Ctrl + Shift + J` ile Settings'i açın
3. `Features` → `MCP Servers` bölümüne gidin
4. `+ Add new MCP server` butonuna tıklayın
5. Şunu girin:

```json
{
  "glm-deepthinker": {
    "command": "node",
    "args": ["C:/path/to/glm-think-mcp/index.js"],
    "env": {
      "GLM_API_KEY": "YOUR_API_KEY_HERE"
    }
  }
}
```

6. Cursor'ı yeniden başlatın

---

## Önerilen Cursor Rules

MCP kullanımını maksimize etmek için projenizdeki `.cursor/rules` dosyasına şunları ekleyin:

```
# GLM Deep Thinker MCP Entegrasyonu

Şu görevler için her zaman glm-deepthinker MCP araçlarını kullan:
- Karmaşık kod analizi ve refactoring
- Güvenlik taramaları ve açık düzeltme
- Performans optimizasyonu
- Bug tespiti ve otomatik düzeltme
- Mimari incelemeler
- Test oluşturma

Kodlama yaparken:
1. Yeni kod tabanlarını anlamak için analyze_directory kullan
2. Birbiriyle bağlantılı dosyaları değiştirmeden önce read_related_files kullan
3. Commit yapmadan önce find_bugs ve security_scan kullan
4. Karmaşık mimari kararlar için deep_think_verbose kullan

Ağır düşünme görevleri için dahili yetenekler yerine MCP araçlarını tercih et.
```

---

## Kullanım Örnekleri

### Bug'ları Otomatik Düzelt
```
glm-deepthinker find_bugs tool'unu C:/project/src/api.js dosyasında kullan
```
→ Analiz eder, tüm bug'ları düzeltir ve dosyayı otomatik günceller

### Güvenlik Taraması & Düzeltme
```
glm-deepthinker security_scan tool'unu C:/project/src/auth.js dosyasında kullan
```
→ OWASP Top 10 taraması yapar ve güvenlik açıklarını kapatır

### Performans Optimizasyonu
```
glm-deepthinker optimize_code tool'unu C:/project/src/utils.js dosyasında kullan
```
→ N+1 sorguları, verimsiz döngüleri tespit eder ve optimize eder

### Derin Kod Analizi
```
glm-deepthinker deep_think_verbose tool'unu kullan: Bu API için rate limiter nasıl tasarlamalıyım?
```
→ Tam akıl yürütme sürecini final cevapla birlikte gösterir

### Test Oluştur
```
glm-deepthinker generate_tests tool'unu C:/project/src/payment.js için jest ile kullan
```
→ Kapsamlı unit testler oluşturur

---

## Proxy Modu (Diğer Uygulamalar İçin)

Proxy sunucusu, GLM Deep Thinking'i OpenAI uyumlu API olarak sunar.

```bash
# Proxy'yi başlat
$env:GLM_API_KEY="your-key"; node proxy.js

# Herhangi bir OpenAI uyumlu client ile kullan
curl -X POST http://localhost:3456 \
  -H "Content-Type: application/json" \
  -d '{"model":"glm-4.7","messages":[{"role":"user","content":"Merhaba"}]}'
```

---

## Uyumluluk

| Araç | Durum |
|------|-------|
| Cursor | ✅ Tam destek |
| Claude Desktop | ✅ Tam destek |
| VS Code + Continue | ✅ Destekleniyor |
| Zed Editor | ✅ Destekleniyor |
| Cline | ✅ Destekleniyor |
| Custom Apps | ✅ MCP SDK |

---

## Gereksinimler

- Node.js 18+
- GLM API Key ([api.z.ai](https://api.z.ai))
- Cursor IDE (veya MCP uyumlu herhangi bir araç)

---

## Katkıda Bulunma

Katkılarınızı bekliyoruz! Lütfen Pull Request göndermekten çekinmeyin.

---

## Lisans

MIT
