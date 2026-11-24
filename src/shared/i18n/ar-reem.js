// Arabic dictionary — server messages and labels that reach the SAWN main interface (Reem UI):
// satellite alerts, Gate A lock decisions and manual metal screening, readiness checks, wireless
// device types, the 3D site, roles and audit actions.
// Format: "English ⇒ Arabic"; {0}, {1}… are variable parts (see ../i18n-core.js).
export default `
Imaging satellite {0} passes overhead in {1} min (max elevation {2} degrees) — cover sensitive activity ⇒ قمر التصوير {0} يمر فوق الموقع خلال {1} دقيقة (أقصى ارتفاع {2}°) — غطِّ الأنشطة الحساسة
Imaging satellite {0} OVERHEAD NOW (max elevation {1} degrees) — cover sensitive activity ⇒ قمر التصوير {0} فوق الموقع الآن (أقصى ارتفاع {1}°) — غطِّ الأنشطة الحساسة
Imaging satellite OVERHEAD ⇒ قمر تصوير فوق الموقع
Airspace above the site ⇒ المجال الجوي فوق الموقع
Orbit prediction (CelesTrak TLE) ⇒ توقّع المدار (CelesTrak TLE)

Gate A NFC reader ⇒ قارئ NFC للبوابة A
Gate A NFC reader (ESP32) ⇒ قارئ NFC للبوابة A (ESP32)
Gate A reader ⇒ قارئ البوابة A
Gate NFC reader ⇒ قارئ NFC للبوابة
gate ⇒ البوابة
perimeter ⇒ المحيط
approach ⇒ الاقتراب
system ⇒ النظام
signage ⇒ اللوحات
Wi-Fi link {0} is open; last NFC tap was {1} min ago. A new tap is needed to prove the reader is currently working. ⇒ اتصال Wi-Fi ‏{0} مفتوح؛ آخر تمرير بطاقة قبل {1} دقيقة. مرّر بطاقة جديدة للتأكد أن القارئ يعمل الآن.
Wi-Fi link {0} is open; an accepted NFC tap was received {1} s ago. ⇒ اتصال Wi-Fi ‏{0} مفتوح؛ وصل تمرير بطاقة مقبول قبل {1} ثانية.
Wi-Fi link {0} is open; waiting for a real {1} NFC tap to prove the reader. ⇒ اتصال Wi-Fi ‏{0} مفتوح؛ بانتظار تمرير بطاقة حقيقي على {1} للتأكد من القارئ.
Hybrid badge input (simulation) ⇒ إدخال البطاقة الهجين (محاكاة)
Not integrated in live operations — available only in Simulation & training. ⇒ غير مربوط بالتشغيل المباشر — متاح فقط في المحاكاة والتدريب.
Reachable from the SAWN server ⇒ متاح من سيرفر صون

Gate A opened remotely ⇒ فُتحت البوابة A عن بُعد
Open Gate A remotely ⇒ فتح البوابة A عن بُعد
Open Gate A remotely for {0} s ⇒ فتح البوابة A عن بُعد لمدة {0} ث
Gate A opened remotely for {0} s ⇒ فُتحت البوابة A عن بُعد لمدة {0} ث
Give the reason for opening Gate A remotely ⇒ اكتب سبب فتح البوابة A عن بُعد
Gate A is not connected — the lock stays closed. Ask again when the gate is back online. ⇒ البوابة A غير متصلة — القفل يبقى مغلقاً. اطلب مرة أخرى عند عودة الاتصال.
Could not apply: {0} ⇒ تعذّر التنفيذ: {0}
Gate lock opened ⇒ فُتح قفل البوابة
Gate lock kept closed ⇒ بقي قفل البوابة مغلقاً
Physical card presented ⇒ مُرّرت بطاقة فعلية
Unlinked physical card presented ⇒ مُرّرت بطاقة فعلية غير مربوطة
Physical NFC credential linked ⇒ رُبطت بطاقة NFC فعلية
Metal check passed (manual) ⇒ اجتاز فحص المعادن (يدوي)
Gate A metal screening mode ⇒ طريقة فحص المعادن في البوابة A
Switched user (demo, no password) ⇒ تبديل الحساب (عرض، بدون كلمة مرور)
Flightradar24 switched on ⇒ تشغيل Flightradar24
Flightradar24 switched off ⇒ إيقاف Flightradar24
System ⇒ النظام
Shift supervisor ⇒ مشرف المناوبة
Administrator ⇒ مدير النظام
Duty officer ⇒ ضابط مناوب
Viewer (read-only) ⇒ مُطّلع (قراءة فقط)
Consultant ⇒ مستشار
announcer ⇒ المذيع الصوتي

Unknown ⇒ غير معروف
Phone ⇒ هاتف
Computer ⇒ حاسب
Smart home / IoT ⇒ منزل ذكي / إنترنت الأشياء
Router / access point ⇒ راوتر / نقطة وصول
Audio (earbuds, speaker) ⇒ صوت (سماعات، مكبّر)
Find My (AirTag or separated Apple device) ⇒ Find My (AirTag أو جهاز Apple منفصل)
Apple device — category not broadcast ⇒ جهاز Apple — نوعه غير مُعلن
live ⇒ مباشر
deauth: ok ⇒ فصل قسري: سليم
beacons: ok ⇒ إشارات البث: سليمة
jamming: ok ⇒ تشويش: لا يوجد
ble: ok ⇒ BLE: سليم

Level 1 · Gate A ⇒ المستوى 1 · البوابة A
Level 5 · Gate B ⇒ المستوى 5 · البوابة B
Gate A · Level 1 ⇒ البوابة A · المستوى 1
Level 1 ⇒ المستوى 1
Level 2 ⇒ المستوى 2
Level 3 ⇒ المستوى 3
Level 4 ⇒ المستوى 4
Level 5 ⇒ المستوى 5
Offices ⇒ المكاتب
Warehouses ⇒ المستودعات
Reception ⇒ الاستقبال
Servers and labs ⇒ الخوادم والمختبرات
Vault · 3 factors ⇒ الخزنة · 3 عوامل
Entry checkpoint · screening ⇒ نقطة الدخول · التفتيش
Gate A ⇒ البوابة A
Gate B ⇒ البوابة B
NFC reader kiosk ⇒ كشك قارئ NFC
Zone D ⇒ المنطقة D
Environmental annex ⇒ الملحق البيئي
Watchtower T-1 ⇒ برج المراقبة T-1
360° camera ⇒ كاميرا 360°
sky dome · not to scale ⇒ قبة السماء · ليست بمقياس رسم
Drone ⇒ درون
Drone critical ⇒ درون حرج
King Khalid Intl (RUH) ⇒ مطار الملك خالد الدولي (RUH)
King Salman Air Base ⇒ قاعدة الملك سلمان الجوية
Monitor ⇒ مراقبة
Warning ⇒ تحذير
Restricted ⇒ محظور
`;
