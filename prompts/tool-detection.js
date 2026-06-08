export const TOOL_LIST = `=== PROJE ÇAPLI ARAÇLAR (API Tabanlı) ===
1. delegate_to_swarm - **KOD ÜRETİMİ VE PROJE İŞLERİ İÇİN #1**: Tüm kod yazma, refactoring, hata bulma/düzeltme, özellik geliştirme görevleri için kullan. Architect → Coder → QA zinciri ile çalışır. (API, CLI değil)
2. read_project - Proje yapısını tara ve önemli dosyaları oku.
3. analyze_directory - Bir klasördeki tüm kodu mimari, güvenlik veya performans için analiz et.
4. analyze_architecture - Genel sistem tasarımını gözden geçir.

=== TEK DOSYA İŞLEMLERİ (filePath gerekli) ===
5. deep_think_code - Belirli bir dosyaya kod yaz/kaydet. filePath verilmişse kullan.
6. read_file - Belirli bir dosyayı oku.
7. write_file - Belirli bir dosyaya içerik yaz/kaydet.
8. find_bugs - [Tek Dosya] Belirli bir dosyayı hatalar için analiz et.
9. refactor_code - [Tek Dosya] Belirli bir dosyayı yeniden düzenle/düzelt.
10. explain_code - [Tek Dosya] Bir dosyayı açıkla.
11. add_comments - [Tek Dosya] Bir dosyaya yorum ekle.
12. generate_tests - [Tek Dosya] Bir dosya için test oluştur.

=== DİĞER ===
13. deep_think_chat - Genel sorular ve sohbet için.
14. list_directory - Belirli bir klasördeki dosyaları listele.
15. search_in_files - Metin desenlerini ara.`;

export const CODE_QUALITY_REQUIREMENTS = `CODE QUALITY REQUIREMENTS (MANDATORY):
- SOLID Principles: SRP (Single Responsibility), OCP, LSP, ISP, DIP.
- DRY (Don't Repeat Yourself): Zero code duplication. Use utility functions.
- Clean Code: Meaningful naming, small functions, no excessive nesting.
- Performance: Efficient DOM manipulation, optimized SQL, lazy-loading patterns.
- Error Handling: Proper try-catch blocks, descriptive error messages.
- Modularity: High cohesion, low coupling. No monolithic files.`;

export const PREMIUM_UI_GUIDELINES = `PREMIUM UI DESIGN PRINCIPLES:
- Cyberpunk/Neon Aesthetics: Use smooth gradients, neon glows, and dark mode.
- Modern Typography: Use Inter, Roboto, or Outfit. No default serif fonts.
- Micro-Animations: Add hover effects, loading transitions, and smooth fades.
- Glassmorphism: Use backdrop-filter: blur() where appropriate.
- Responsive Design: Must work flawlessly on Mobile, Tablet, and Desktop.
- Performance: Ensure 60fps animations. Avoid heavy layout shifts.`;

export function buildToolDetectionPrompt(userPrompt) {
  return `Persona: Strategic Intent Dispatcher
Task: Select the BEST tool for the user's request. 

STRICT DISPATCHING RULES:
1. **Parameter Guard**: If a tool is labeled [Tek Dosya] (like find_bugs, read_file) but the user DID NOT specify a file path, DO NOT choose it.
2. **API Priority**: API tabanlı araçları (delegate_to_swarm, deep_think_chat) her zaman öncelikli kullan. Harici CLI araçları kullanma.
3. **Code Generation = Swarm**: Tüm kod yazma, refactoring, hata bulma/düzeltme, özellik geliştirme gibi görevler için **delegate_to_swarm** kullan. Architect → Coder → QA zinciri kaliteli kod üretir.
4. **Only use deep_think_code when**: Kullanıcı açıkça bir dosya yolu (filePath) belirtmişse ve tek bir dosyaya yazılacaksa kullanılabilir. Aksi halde delegate_to_swarm tercih et.
5. **Turkish Mapping**: "kod yaz", "ekran yap", "hata var mı", "sorunları bul", "login yap", "özellik ekle" → hep **delegate_to_swarm**. Genel sorular ("bu nedir", "nasıl çalışır") → deep_think_chat.

User Request: "${userPrompt}"

${TOOL_LIST}

Response Format (JSON):
{
  "tool": "tool_name",
  "confidence": 0.0-1.0,
  "parameters": {
     "key": "value"
  },
  "reasoning": "Explain why this tool was chosen over others (mention if it was upgraded to project-wide due to missing parameters)"
}`;
}
