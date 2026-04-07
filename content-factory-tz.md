# ТЗ: Создать сценарий "Content Factory" в Make.com

## Задача
Создать сценарий (scenario) в Make.com, который автоматизирует контент-производство: анализ конкурентов в Instagram, транскрибацию видео, обработку текста через ChatGPT, озвучку через 11Labs и генерацию аватара через HeyGen.

Данные хранятся в **Notion** (база данных).

---

## Структура сценария

```
Webhook (триггер)
  → Webhook Response (авто-закрытие окна)
    → Notion: Retrieve a Page (получить данные строки)
      → Router (5 маршрутов по значению параметра "button")
```

### Маршрут 1: Анализ Instagram (button = "start")
```
Фильтр: button = "start"
→ Apify: Run an Actor (Instagram Reel Scraper, передать username и количество видео)
   - synchronous: true (ждать завершения)
   - input JSON: {"usernames": ["{{username}}"], "resultsLimit": {{количество}}}
→ Apify: Get Dataset Items (получить результаты парсинга)
→ Notion: Create a Database Item (записать каждое видео в базу)
   - Свойства: Ник Инстаграма, Ссылка на видео, Preview URL, Медиа URL, Просмотры, Лайки, Описание, Комментарии, Дата добавления
```

### Маршрут 2: Транскрибация (button = "trans")
```
Фильтр: button = "trans"
→ HTTP: Get a File (скачать видео по URL из поля "Медиа")
→ AssemblyAI: Upload a File (загрузить файл)
→ AssemblyAI: Transcribe an Audio File
   - language_detection: true
   - punctuate: true
   - format_text: true
→ Notion: Update a Page (записать транскрипцию в поле "Транскриптер")
```

### Маршрут 3: ChatGPT обработка (button = "gpt")
```
Фильтр: button = "gpt"
→ Tools: Set Multiple Variables
   - Переменная "assistant_id" выбирается по значению поля "Выбор":
     - "Перевод" → asst_ID_переводчика
     - "10 заголовков" → asst_ID_заголовков
     - "Больше материала" → asst_ID_материала
→ OpenAI: Message an Assistant (или Create a Completion)
   - assistant_id: {{переменная из предыдущего шага}}
   - message: {{текст из поля "Транскриптер"}}
→ Notion: Update a Page (записать результат в поле "Результат ГПТ")
```

### Маршрут 4: Озвучка 11Labs (button = "lab")
```
Фильтр: button = "lab"
→ Notion: Retrieve a Page (получить текст из "Готовый результат")
→ ElevenLabs: Text to Speech
   - model: eleven_multilingual_v2
   - text: {{текст из "Готовый результат"}}
   - stability: 1
   - similarity_boost: 1
→ Google Drive: Upload a File (загрузить аудио на диск)
→ Google Drive: Share a File (сделать публичную ссылку, type: anyone, role: reader)
→ Notion: Update a Page (записать ссылку на аудио в поле "Озвучка")
```

### Маршрут 5: HeyGen аватар (button = "gen")
```
Фильтр: button = "gen"
→ Notion: Retrieve a Page (получить URL озвучки)
→ HeyGen: Create an Avatar Video
   - avatar_id: (выбрать свой аватар)
   - voice_type: audio
   - audio_url: {{ссылка из поля "Озвучка"}}
→ Tools: Sleep (300 секунд — ожидание генерации)
→ HeyGen: Get a Video (получить готовое видео по video_id)
→ Notion: Update a Page (записать URL видео в поле "HeyGen результат")
```

---

## Webhook

Один Custom Webhook на весь сценарий. Принимает параметры:
- `page_id` — ID страницы Notion
- `button` — какой маршрут запустить: `start`, `trans`, `gpt`, `lab`, `gen`

URL вебхука вставляется в кнопки Notion (Button → Open URL):
```
https://hook.eu2.make.com/WEBHOOK_ID?page_id={{page_id}}&button=start
```

Webhook Response возвращает HTML `<script>window.close();</script>` для автозакрытия окна.

---

## Фильтры на роутере

Каждый маршрут имеет фильтр (condition):
- Condition: `{{webhook.button}}` equals `start` / `trans` / `gpt` / `lab` / `gen`

---

## База данных Notion

Создать базу со следующими свойствами:

| Свойство | Тип | Назначение |
|---|---|---|
| Name | Title | Название записи |
| Ник Инстаграма | Text | Username аккаунта |
| Количество | Number | Сколько видео парсить |
| Ссылка на видео | URL | URL поста |
| Preview | URL | Превью-картинка |
| Медиа | URL | URL видеофайла |
| Просмотры | Number | Кол-во просмотров |
| Лайки | Number | Кол-во лайков |
| Описание видео | Text | Caption поста |
| Комментарии | Number | Кол-во комментариев |
| Когда добавлено | Date | Дата публикации |
| Сколько дней назад | Formula | `dateBetween(now(), prop("Когда добавлено"), "days")` |
| В работу | Select | Опции: Статус, В работу, Черновик |
| Транскриптер | Text | Результат транскрибации |
| Выбор | Select | Опции: Перевод, 10 заголовков, Больше материала |
| Результат ГПТ | Text | Ответ ChatGPT |
| Готовый результат | Text | Финальный текст для озвучки |
| Озвучка | URL | Ссылка на аудиофайл |
| HeyGen результат | URL | Ссылка на видео с аватаром |

### Кнопки Notion (Button property, действие "Open URL"):

| Кнопка | Значение button | Цвет |
|---|---|---|
| Запуск | start | Красный |
| Транскрибация | trans | Синий |
| ChatGPT | gpt | Зелёный |
| 11 Labs | lab | Оранжевый |
| HeyGen | gen | Фиолетовый |

---

## Необходимые подключения (Connections)

1. **Notion** — через OAuth или API key
2. **Apify** — API token (из Settings → Integrations → API tokens)
3. **AssemblyAI** — API key (из Dashboard → API Keys)
4. **OpenAI** — API key (из platform.openai.com → API Keys)
5. **ElevenLabs** — API key (из профиля → API Keys)
6. **Google Drive** — OAuth (Google аккаунт)
7. **HeyGen** — API token (из Settings → API)

---

## Ассистенты OpenAI (создать заранее)

На platform.openai.com → Assistants создать:

1. **Ассистент-переводчик** — инструкция: "Переведи текст на русский язык. Сохрани структуру абзацев."
2. **Ассистент-заголовки** — инструкция: "На основе текста создай 10 цепляющих заголовков для коротких видео."
3. **Ассистент-материал** — инструкция: "На основе текста предложи расширенный материал, дополнительные факты и идеи для контента."

Модель: gpt-4o-mini (дешевле) или gpt-4o.

---

## Визуальная схема

```
[Webhook] → [Response] → [Notion Get] → [Router]
                                            ├── start → [Apify Run] → [Apify Get] → [Notion Create]
                                            ├── trans → [HTTP Get] → [AssemblyAI Upload] → [AssemblyAI Transcribe] → [Notion Update]
                                            ├── gpt   → [Set Vars] → [OpenAI Assistant] → [Notion Update]
                                            ├── lab   → [Notion Get] → [11Labs TTS] → [GDrive Upload] → [GDrive Share] → [Notion Update]
                                            └── gen   → [Notion Get] → [HeyGen Create] → [Sleep 300s] → [HeyGen Get] → [Notion Update]
```

---

## Важные настройки

- Router: каждый маршрут с фильтром по `button`
- Apify: synchronous = true (ждать результата)
- AssemblyAI: language_detection = true
- Sleep перед HeyGen Get: 300 секунд (5 минут)
- Google Drive: Share type = anyone, role = reader
- Webhook Response: status 200, body = `<script>window.close();</script>`

## Сортировка и группировка Notion

- View с сортировкой: Просмотры → Descending
- Группировка: по "Ник Инстаграма"
