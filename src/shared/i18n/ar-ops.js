// Arabic dictionary — incidents, Gate A checkpoint, drone & cameras, site map, 3D model, training
// scenarios, and the messages the server sends (incidents, notifications, audit entries, errors).
// Format: "English ⇒ Arabic"; {0}, {1}… are variable parts (see ../i18n.js).
export default `
Search incidents ⇒ البحث في الحوادث
Filter incidents ⇒ تصفية الحوادث
No incidents in this view. ⇒ لا توجد حوادث في هذا العرض.
{0} shown ⇒ {0} معروضة
Select an incident to see why it was flagged, the evidence and your options. ⇒ اختر حادثة لترى سبب الإبلاغ عنها والأدلة والخيارات المتاحة.
Why was this flagged? ⇒ لماذا تم الإبلاغ عن هذا؟
Event timeline and details ⇒ تسلسل الأحداث والتفاصيل
Evidence ⇒ الأدلة
Evidence snapshot ⇒ لقطة دليل
Evidence snapshot (simulated) ⇒ لقطة دليل (محاكاة)
Your decision ⇒ قرارك
Decision ⇒ القرار
Severity ⇒ الخطورة
Raised ⇒ تاريخ الإنشاء
Reason ⇒ السبب
Address ⇒ العنوان
Type / OS ⇒ النوع / نظام التشغيل
Wireless device ⇒ جهاز لاسلكي
Confirm incident ⇒ تأكيد الحادثة
Dismiss ⇒ استبعاد
Dismiss {0} as a false alarm ⇒ استبعاد {0} كإنذار كاذب
False alarm ⇒ إنذار كاذب
Escalate ⇒ تصعيد
Escalate {0} ⇒ تصعيد {0}
Escalate to supervisor ⇒ التصعيد إلى المشرف
Escalated — waiting for the shift supervisor ⇒ مصعّدة — بانتظار مشرف المناوبة
Reopen ⇒ إعادة فتح
Add note ⇒ إضافة ملاحظة
New note ⇒ ملاحظة جديدة
Add a note for the record ⇒ أضف ملاحظة للسجل
Send drone ⇒ إرسال المسيّرة
Drone on the way… ⇒ المسيّرة في الطريق…
Drone feed attached ⇒ تم إرفاق بث المسيّرة
Show in 3D model ⇒ عرض في النموذج ثلاثي الأبعاد
Show on radar ⇒ عرض على الرادار
A critical incident is not closed by one person — sent for a second approval: {0} ⇒ الحادثة الحرجة لا يغلقها شخص واحد — أُرسلت لموافقة ثانية: {0}
Camera inference · confidence {0} ⇒ استنتاج الكاميرا · الثقة {0}
{0} dBm at {1} ⇒ {0} dBm عند {1}
{0} ({1} sightings) ⇒ {0} ({1} رصد)
LIVE · {0} ⇒ مباشر · {0}
SIMULATED · {0} ⇒ محاكاة · {0}
SIMULATOR ⇒ المحاكي
AIRSPACE SENSOR ⇒ مستشعر المجال الجوي
BEHAVIOUR ANALYSIS ⇒ تحليل السلوك
GATE A ⇒ البوابة A
HEALTH CHECK ⇒ فحص الصحة
New ⇒ جديدة
NEW ⇒ جديدة
Acknowledged ⇒ مُستلمة
ACK ⇒ مُستلمة
Confirmed ⇒ مؤكدة
Escalated ⇒ مصعّدة
ESCALATED ⇒ مصعّدة
Dismissed ⇒ مستبعدة
DISMISSED ⇒ مستبعدة
VERIFIED ⇒ مؤكدة
Critical ⇒ حرجة
High ⇒ عالية
Medium ⇒ متوسطة
Info ⇒ معلومات
critical ⇒ حرجة
high ⇒ عالية
info ⇒ معلومات

Gate A checkpoint ⇒ نقطة تفتيش البوابة A
Tap a badge (simulator on the right) — the system runs every stage and decides. ⇒ مرّر شارة (من المحاكي المجاور) — يُجري النظام كل المراحل ويقرر.
Face, metal and explosive-trace results are simulated until that hardware is connected. The wireless stage always uses the live airspace sensor (devices in the gate zone right now). ⇒ نتائج الوجه والمعادن وآثار المتفجرات محاكاة حتى تُوصَّل تلك الأجهزة. المرحلة اللاسلكية تستخدم دائمًا مستشعر المجال الجوي المباشر (الأجهزة داخل نطاق البوابة الآن).
Badge tap ⇒ تمرير الشارة
Tap badge ⇒ تمرير الشارة
Face camera result ⇒ نتيجة كاميرا الوجه
Matches the enrolled face ⇒ يطابق الوجه المسجّل
Does not match ⇒ لا يطابق
No alarm ⇒ لا يوجد إنذار
Metal object ⇒ جسم معدني
Switched-off device found ⇒ عُثر على جهاز مطفأ
No trace ⇒ لا توجد آثار
Trace detected ⇒ اكتُشفت آثار
No badge taps yet. ⇒ لم تُمرَّر أي شارة بعد.
Decision lane ⇒ مسار القرار
Wireless device policy ⇒ سياسة الأجهزة اللاسلكية
Going to ⇒ متجه إلى
SIMULATED INPUTS ⇒ مدخلات محاكاة
Badge ⇒ الشارة
Face match ⇒ مطابقة الوجه
Metal detector ⇒ كاشف المعادن
Explosive trace ⇒ آثار المتفجرات
Wireless devices ⇒ الأجهزة اللاسلكية
Who are you? Card + directory (works offline from the local copy) ⇒ من أنت؟ البطاقة + الدليل (يعمل دون اتصال من النسخة المحلية)
Is it really you? Camera vs. enrolled face ⇒ هل هو أنت حقًا؟ الكاميرا مقابل الوجه المسجّل
Weapons, metal and switched-off devices ⇒ الأسلحة والمعادن والأجهزة المطفأة
Swab analysed by the ETD ⇒ مسحة يحللها كاشف آثار المتفجرات
Every device in the gate zone authorized for that level ⇒ كل جهاز في نطاق البوابة مصرّح به لذلك المستوى
All stages passed ⇒ اجتازت جميع المراحل
ALLOW ⇒ سماح
ALLOW (override) ⇒ سماح (تجاوز)
ALLOW* ⇒ سماح*
DENY ⇒ رفض
REFER ⇒ إحالة
allow ⇒ سماح
deny ⇒ رفض
refer ⇒ إحالة
Any authorized device ⇒ أي جهاز مصرّح
C-9999 · unknown card ⇒ C-9999 · بطاقة غير معروفة
Central directory online ⇒ الدليل المركزي متصل
Central directory unreachable — using the local copy ⇒ الدليل المركزي غير متاح — يُستخدم النسخة المحلية
Gate opened by override. ⇒ فُتحت البوابة بالتجاوز.
Gate opens ⇒ البوابة تُفتح
Gate stays closed ⇒ البوابة تبقى مغلقة
Last 24 h: {0} allowed · {1} denied · {2} referred ⇒ آخر 24 ساعة: {0} مسموح · {1} مرفوض · {2} محال
Local copy not created yet ⇒ لم تُنشأ النسخة المحلية بعد
Local copy: {0} people, synced {1} ⇒ النسخة المحلية: {0} شخص، متزامنة {1}
Must be registered to the person: {0} ⇒ يجب أن يكون مسجّلًا باسم الشخص: {0}
Not reached. ⇒ لم يُصل إليها.
Officer must check by hand before opening ⇒ يجب أن يتحقق الضابط يدويًا قبل الفتح
Offline — local directory copy ⇒ غير متصل — النسخة المحلية من الدليل
Open anyway… ⇒ فتح على أي حال…
Open the gate against the system’s decision ⇒ فتح البوابة خلافًا لقرار النظام
Opened by {0} against the system’s decision ⇒ فتحها {0} خلافًا لقرار النظام
Override by {0} ⇒ تجاوز بواسطة {0}
Reason (required) ⇒ السبب (إلزامي)
Request approval ⇒ طلب موافقة
Sent for a second approval — see Approvals. ⇒ أُرسل لموافقة ثانية — راجع الموافقات.
Source: {0} ⇒ المصدر: {0}
The system said {0}: {1} Opening anyway needs a reason and a second approver (shift supervisor). Both names are recorded. ⇒ قرار النظام {0}: {1} الفتح على أي حال يتطلب سببًا وموافقًا ثانيًا (مشرف مناوبة). يُسجَّل الاسمان.
Unknown person ⇒ شخص غير معروف
UNAUTHORIZED ⇒ غير مصرّح
unknown ⇒ غير معروف
authorized ⇒ مصرّح
{0} OK ⇒ {0} سليم
{0} DOWN ⇒ {0} معطّل
Unregistered device: {0} · face match ≥ {1} · local copy valid {2} h ⇒ جهاز غير مسجّل: {0} · مطابقة الوجه ≥ {1} · النسخة المحلية صالحة {2} ساعة
refer to officer ⇒ إحالة إلى ضابط
Facility Access Control ⇒ التحكم في الوصول إلى المنشأة
Area types and factors follow ISC ⇒ أنواع المناطق وعوامل التحقق وفق ISC
(2020) and NIST SP 800-116: one factor for Controlled, two for Limited, three for Exclusion areas. ⇒ (2020) وNIST SP 800-116: عامل واحد للمناطق المضبوطة، واثنان للمحدودة، وثلاثة للمناطق الحصرية.
1 factor: card, contactless · review yearly · logs 12 mo ⇒ عامل واحد: بطاقة لاتلامسية · مراجعة سنوية · سجلات 12 شهرًا
2 factors: card + PIN · visitors need a close escort · review 3 mo ⇒ عاملان: بطاقة + رمز PIN · الزوار يحتاجون مرافقًا قريبًا · مراجعة كل 3 أشهر
3 factors: card + PIN + fingerprint · individual authorization only · logs ⇒ 3 عوامل: بطاقة + PIN + بصمة · تصريح فردي فقط · سجلات
Reception (public lobby) ⇒ الاستقبال (البهو العام)
Screened at the checkpoint · visitors show ID, get a badge and an escort ⇒ تفتيش عند نقطة التفتيش · يُبرز الزوار الهوية ويحصلون على شارة ومرافق
Offices · Controlled area ⇒ المكاتب · منطقة مضبوطة
Warehouses · Controlled area ⇒ المستودعات · منطقة مضبوطة
Server room and labs · Limited area ⇒ غرفة الخوادم والمختبرات · منطقة محدودة
Control room and vault · Exclusion area ⇒ غرفة التحكم والخزنة · منطقة حصرية
A controlled gate into every level (Gates 1–5), each with its own CCTV ⇒ بوابة مضبوطة لكل مستوى (البوابات 1–5)، لكل منها كاميرا مراقبة خاصة
The idea in three steps ⇒ الفكرة في ثلاث خطوات
Sensors, cameras and the detector pick up an event in the facility. ⇒ تلتقط المستشعرات والكاميرات والكاشف حدثًا في المنشأة.
SAWN links it to identity, access and device records and explains why it was flagged. ⇒ يربطه SAWN بسجلات الهوية والوصول والأجهزة ويشرح سبب الإبلاغ عنه.
The officer verifies, sends the drone if needed, and decides. ⇒ يتحقق الضابط، ويرسل المسيّرة عند الحاجة، ويتخذ القرار.

Drone DR-1 ⇒ المسيّرة DR-1
Drone ⇒ المسيّرة
Drones ⇒ المسيّرات
Drone link ⇒ اتصال المسيّرة
Drone destination ⇒ وجهة المسيّرة
Return to pad ⇒ العودة إلى المنصة
Mission log ⇒ سجل المهام
Camera feeds ⇒ بث الكاميرات
Battery ⇒ البطارية
Altitude ⇒ الارتفاع
Destination ⇒ الوجهة
Incident ⇒ الحادثة
Normal ⇒ طبيعي
NORMAL ⇒ طبيعي
Back on its pad ⇒ عادت إلى منصتها
On its pad ⇒ على منصتها
En route ⇒ في الطريق
Sweeping ⇒ مسح
Hovering · live feed ⇒ تحوم · بث مباشر
Hovering over {0} · live feed ⇒ تحوم فوق {0} · بث مباشر
Drone on its pad · no feed ⇒ المسيّرة على منصتها · لا يوجد بث
On the way to the site… ⇒ في الطريق إلى الموقع…
Returning to pad ⇒ العودة إلى المنصة
No missions yet ⇒ لا توجد مهام بعد
Drone DR-1 is already on a mission ⇒ المسيّرة DR-1 في مهمة بالفعل
Drone DR-1 took off for {0} ⇒ أقلعت المسيّرة DR-1 نحو {0}
Drone feed attached to {0} ⇒ أُرفق بث المسيّرة بـ {0}
the incident ⇒ الحادثة
Alert · {0} ⇒ تنبيه · {0}
15 m (simulated) ⇒ 15 م (محاكاة)
Real flights are subject to civil aviation rules and venue approval. Dispatches and attached evidence are recorded against the incident. ⇒ الرحلات الحقيقية تخضع لأنظمة الطيران المدني وموافقة الموقع. تُسجَّل عمليات الإرسال والأدلة المرفقة على الحادثة.
DR-1 · Drone camera ⇒ DR-1 · كاميرا المسيّرة
CAM-2 · Sidewalk and visitors ⇒ CAM-2 · الرصيف والزوار
T-1 · Watchtower 360° PTZ ⇒ T-1 · برج المراقبة PTZ ‏360°
360° coverage ⇒ تغطية 360°
Environmental room and drone pad ⇒ الغرفة البيئية ومنصة المسيّرة
From site ⇒ من الموقع
Watchtower: 360° PTZ camera and searchlight ⇒ برج المراقبة: كاميرا PTZ ‏360° وكشاف
Perimeter cameras on the fence and building corners ⇒ كاميرات المحيط على السياج وزوايا المبنى
Streaming 25 fps (simulated) ⇒ بث 25 إطارًا/ث (محاكاة)
OK (simulated) ⇒ سليم (محاكاة)
Armed · no alarm ⇒ مُفعّل · لا يوجد إنذار

Facility plan ⇒ مخطط المنشأة
Facility plan · device status and open incidents ⇒ مخطط المنشأة · حالة الأجهزة والحوادث المفتوحة
On the model ⇒ على النموذج
Airspace layer ⇒ طبقة المجال الجوي
Reset view ⇒ إعادة ضبط العرض
1:1 screening tunnel ⇒ نفق تفتيش فردي
A · Gate & screening ⇒ A · البوابة والتفتيش
Alarm ⇒ إنذار
Alarm · {0} ⇒ إنذار · {0}
Connected over USB (fallback) ⇒ متصل عبر USB (احتياطي)
Connected via ⇒ متصل عبر
D · Environment ⇒ D · البيئة
D · Environment room ⇒ D · الغرفة البيئية
Data ⇒ البيانات
Enter ⇒ دخول
Feed disconnected ⇒ البث منقطع
ID ⇒ المعرّف
L1 · Reception ⇒ م1 · الاستقبال
L2 · Offices ⇒ م2 · المكاتب
L3 · Warehouses ⇒ م3 · المستودعات
L4 · Server & labs ⇒ م4 · الخوادم والمختبرات
L5 · Vault ⇒ م5 · الخزنة
Live feed connected ⇒ البث المباشر متصل
Not reporting ⇒ لا يرسل
Reading ⇒ القراءة
REAL ⇒ حقيقي
Real hardware ⇒ أجهزة حقيقية
S · Parking ⇒ S · المواقف
Simulated subsystem ⇒ نظام فرعي محاكى
Street ⇒ الشارع
USB serial ⇒ USB تسلسلي
Warning ⇒ تحذير
Sidewalk ⇒ الرصيف
{0} · {1} devices in range · {2} at the gate ⇒ {0} · {1} جهاز في النطاق · {2} عند البوابة
hazard warning ⇒ تحذير من خطر
Airspace sensor (ESP32) ⇒ مستشعر المجال الجوي (ESP32)
Behaviour camera ⇒ كاميرا السلوك
Closed ⇒ مغلق
Entrance door sensor ⇒ مستشعر باب المدخل
Entrance motion sensor ⇒ مستشعر حركة المدخل
Environment node ⇒ عقدة البيئة
Gate A ⇒ البوابة A
Gate A node ⇒ عقدة البوابة A
Gate NFC reader ⇒ قارئ NFC للبوابة
Lane beam + lights ⇒ حزمة المسار + الأضواء
Level 1 ⇒ المستوى 1
Level 2 ⇒ المستوى 2
Level 3 ⇒ المستوى 3
Level 4 ⇒ المستوى 4
Level 5 ⇒ المستوى 5
Level 2 · Offices ⇒ المستوى 2 · المكاتب
Level 4 · Server room ⇒ المستوى 4 · غرفة الخوادم
Level 4 card + PIN reader ⇒ قارئ بطاقة + PIN للمستوى 4
Level 4 door sensor ⇒ مستشعر باب المستوى 4
Level 4 motion sensor ⇒ مستشعر حركة المستوى 4
Level 5 card + PIN + fingerprint ⇒ بطاقة + PIN + بصمة للمستوى 5
Levels 1–3 ⇒ المستويات 1–3
Levels 4–5 node ⇒ عقدة المستويات 4–5
Local computer (USB) ⇒ الحاسوب المحلي (USB)
Office temp/humidity ⇒ حرارة/رطوبة المكتب
OLED display ⇒ شاشة OLED
Overhead camera ⇒ كاميرا علوية
Pedestrian barrier ⇒ حاجز المشاة
Perimeter camera centre ⇒ كاميرا المحيط الوسطى
Perimeter camera east ⇒ كاميرا المحيط الشرقية
Perimeter camera west ⇒ كاميرا المحيط الغربية
SAWN console PC ⇒ حاسوب وحدة تحكم SAWN
Tray entry beam ⇒ حزمة دخول الصينية
VOC sensor ⇒ مستشعر المركبات العضوية المتطايرة
Warning beacon ⇒ ضوء تحذير
Watchtower 360° PTZ + searchlight ⇒ برج المراقبة PTZ ‏360° + كشاف
Zone D ⇒ المنطقة D
Zone D temp/humidity ⇒ حرارة/رطوبة المنطقة D
Zone D warning light ⇒ ضوء تحذير المنطقة D
360° dome · Level {0} ⇒ قبة 360° · المستوى {0}
Gate {0} CCTV · into Level {1} ⇒ كاميرا البوابة {0} · إلى المستوى {1}
person · fence ⇒ شخص · سياج
pose: altercation ⇒ الوضعية: شجار
visitor · no escort ⇒ زائر · بدون مرافق
B1 · Public hall ⇒ B1 · القاعة العامة
Roof ⇒ السطح
Security Operations · live ⇒ العمليات الأمنية · مباشر
ESP32 · wireless gate ⇒ ESP32 · البوابة اللاسلكية
Watchtower · 360° ⇒ برج المراقبة · 360°
Public lobby · screened ⇒ البهو العام · مُفتَّش
Screening: bags + magnetometer ⇒ التفتيش: الحقائب + كاشف المعادن
Visitor ID check · badge ⇒ التحقق من هوية الزائر · شارة
Card · contactless ⇒ بطاقة · لاتلامسية
Card + PIN · contact ⇒ بطاقة + PIN · تلامسية
Card + PIN + fingerprint ⇒ بطاقة + PIN + بصمة
Controlled · 1 factor ⇒ مضبوطة · عامل واحد
Limited · 2 factors ⇒ محدودة · عاملان
Exclusion · 3 factors ⇒ حصرية · 3 عوامل
GATE {0} ⇒ البوابة {0}
LEVEL {0} ⇒ المستوى {0}
AIRSPACE ⇒ المجال الجوي

Airspace & radio ⇒ المجال الجوي واللاسلكي
Camera and behaviour ⇒ الكاميرا والسلوك
Entry and cards ⇒ الدخول والبطاقات
Screening, doors and levels ⇒ التفتيش والأبواب والمستويات
Environment ⇒ البيئة
Perimeter ⇒ المحيط
Authorised card (normal entry) ⇒ بطاقة مصرّحة (دخول عادي)
Card at two gates ⇒ بطاقة عند بوابتين
Circling the perimeter (proactive) ⇒ الدوران حول المحيط (استباقي)
Cut / restore network ⇒ قطع / استعادة الشبكة
Door opened without badge ⇒ فُتح الباب دون شارة
Door without badge ⇒ باب دون شارة
Drone detected (Remote ID) ⇒ اكتُشفت مسيّرة (المعرّف عن بُعد)
Drone over the site (Remote ID) ⇒ مسيّرة فوق الموقع (المعرّف عن بُعد)
Drone detected ⇒ اكتُشفت مسيّرة
Environmental anomaly ⇒ شذوذ بيئي
Evil twin access point ⇒ نقطة وصول مزيفة
Explosive trace (ETD) ⇒ آثار متفجرات (ETD)
Explosive trace detected ⇒ اكتُشفت آثار متفجرات
Fingerprint mismatch (Level 5) ⇒ عدم تطابق البصمة (المستوى 5)
Fingerprint mismatch × 2 ⇒ عدم تطابق البصمة × 2
Level 5 fingerprint mismatch ⇒ عدم تطابق البصمة في المستوى 5
Hacking tool at the gate ⇒ أداة اختراق عند البوابة
Hacking tool detected ⇒ اكتُشفت أداة اختراق
Hostile reconnaissance: circling the perimeter ⇒ استطلاع عدائي: الدوران حول المحيط
Loitering ⇒ تسكّع
Odd behaviour: loitering ⇒ سلوك غريب: تسكّع
Metal detection ⇒ كشف المعادن
Metal presence ⇒ وجود معادن
Perimeter breach ⇒ اختراق المحيط
Perimeter breach: fence climb ⇒ اختراق المحيط: تسلق السياج
Possible altercation ⇒ شجار محتمل
Possible violence: altercation ⇒ عنف محتمل: شجار
Possible radio jamming ⇒ تشويش لاسلكي محتمل
Restricted-zone entry (camera) ⇒ دخول منطقة مقيدة (كاميرا)
Revoked card ⇒ بطاقة ملغاة
Sensor fault ⇒ عطل في المستشعر
Staff-zone entry ⇒ دخول منطقة الموظفين
Suspicious behaviour pattern ⇒ نمط سلوك مشبوه
Suspicious pattern ⇒ نمط مشبوه
Unattended object ⇒ جسم متروك
Visible bladed weapon ⇒ سلاح أبيض ظاهر
Visible bladed weapon (camera) ⇒ سلاح أبيض ظاهر (كاميرا)
Visitor without escort ⇒ زائر بدون مرافق
Wi-Fi deauthentication attack ⇒ هجوم فصل اتصال Wi-Fi
Bluetooth advertisement flood ⇒ إغراق بإعلانات البلوتوث
Beacon flood (fake access points) ⇒ إغراق بالإشارات (نقاط وصول مزيفة)
Cross-gate conflict ⇒ تعارض بين البوابات
Test or drill ⇒ اختبار أو تمرين
Incident raised ⇒ أُنشئت حادثة
Lane closed ⇒ أُغلق المسار
Detector status ⇒ حالة الكاشف
Snapshot now ⇒ لقطة الآن
Snapshot when left ⇒ لقطة عند المغادرة
Snapshot with object box ⇒ لقطة مع إطار الجسم
Owner’s path ⇒ مسار المالك
Normal behaviour after check ⇒ سلوك طبيعي بعد التحقق
Device registered after check ⇒ سُجّل الجهاز بعد التحقق
Gate 4 stayed locked ⇒ بقيت البوابة 4 مقفلة
Level 5 door stayed locked ⇒ بقي باب المستوى 5 مقفلًا
PIN accepted ⇒ قُبل رمز PIN
Armed ⇒ مُفعّل
Checkpoint A ⇒ نقطة التفتيش A
A · Checkpoint ⇒ A · نقطة التفتيش
A · Checkpoint (airspace sensor) ⇒ A · نقطة التفتيش (مستشعر المجال الجوي)
A · Pedestrian gate ⇒ A · بوابة المشاة
Airspace above the site ⇒ المجال الجوي فوق الموقع
Perimeter · around the site ⇒ المحيط · حول الموقع
Perimeter · east fence ⇒ المحيط · السياج الشرقي
Perimeter · west fence ⇒ المحيط · السياج الغربي
Perimeter · street side ⇒ المحيط · جهة الشارع
Perimeter · watchtower ⇒ المحيط · برج المراقبة
Sidewalk at the gate ⇒ الرصيف عند البوابة
Sidewalk by the checkpoint ⇒ الرصيف بجانب نقطة التفتيش
Inside the gate zone ⇒ داخل نطاق البوابة
Gate 4 · Level 4 (Limited area) ⇒ البوابة 4 · المستوى 4 (منطقة محدودة)
Gate A + Level 4 ⇒ البوابة A + المستوى 4
Level 3 · near the Level 4 door ⇒ المستوى 3 · قرب باب المستوى 4
Level 3 · staff corridor B3 ⇒ المستوى 3 · ممر الموظفين B3
Level 4 · Server room and labs ⇒ المستوى 4 · غرفة الخوادم والمختبرات
Level 5 · Control room and vault ⇒ المستوى 5 · غرفة التحكم والخزنة
Level 5 · Vault room ⇒ المستوى 5 · غرفة الخزنة
Access eligibility checked (not an authentication, gate decision or entry) ⇒ فحص أهلية الوصول (ليس تحققاً من الهوية ولا قرار بوابة ولا دخولاً)
Environmental monitoring area ⇒ منطقة المراقبة البيئية
D · Environmental monitoring ⇒ D · المراقبة البيئية
S · Vehicle gate ⇒ S · بوابة المركبات
Card C-1017 is revoked in the access system and is on the Do Not Admit list. It was presented at pedestrian gate A. Entry was denied and barrier A3 stayed closed. ⇒ البطاقة C-1017 ملغاة في نظام الدخول ومدرجة في قائمة «ممنوع الدخول». قُدّمت عند بوابة المشاة A. رُفض الدخول وبقي الحاجز A3 مغلقًا.
Card C-1042 was read at pedestrian gate A and then at reader C1 8 s later; the configured minimum walking time is 45 s. Possible cloned card. ⇒ قُرئت البطاقة C-1042 عند بوابة المشاة A ثم عند القارئ C1 بعد 8 ثوانٍ؛ والحد الأدنى المضبوط لزمن المشي 45 ثانية. بطاقة مستنسخة محتملة.
Card C-1001 and its PIN were accepted at the Level 5 door, but the fingerprint did not match the card holder’s enrolled template on 2 attempts. The door stayed locked: Level 5 needs all three factors. ⇒ قُبلت البطاقة C-1001 ورمزها عند باب المستوى 5، لكن البصمة لم تطابق قالب حامل البطاقة المسجّل في محاولتين. بقي الباب مقفلًا: المستوى 5 يتطلب العوامل الثلاثة.
Visitor card C-1101 was presented at Gate 4 with no escort card read in the previous 10 s, and the Gate 4 camera shows no escort within 3 m. Level 4 is a Limited area, where visitors need a continuous, close escort. Entry was denied. ⇒ قُدّمت بطاقة الزائر C-1101 عند البوابة 4 دون قراءة بطاقة مرافق في الثواني العشر السابقة، وكاميرا البوابة 4 لا تُظهر مرافقًا ضمن 3 أمتار. المستوى 4 منطقة محدودة يحتاج فيها الزوار مرافقًا قريبًا ومستمرًا. رُفض الدخول.
The Level 4 door opened with no card + PIN at reader C1 in the previous 10 s. Motion sensor C3 detected movement 2 s later. ⇒ فُتح باب المستوى 4 دون بطاقة + PIN عند القارئ C1 في الثواني العشر السابقة. رصد مستشعر الحركة C3 حركة بعد ثانيتين.
Metal-presence alarm from detector MD-A1 for 0.8 s during a tray pass (beam A6 broken). The detector reports metal only and does not identify the object. ⇒ إنذار وجود معادن من الكاشف MD-A1 لمدة 0.8 ثانية أثناء مرور صينية (انقطاع الحزمة A6). يُبلغ الكاشف عن المعادن فقط ولا يحدد الجسم.
The explosive trace detector found a nitrate-based trace on the swab from a bag. Hold the person and the bag, keep the area clear and call the response team. Traces can also come from legitimate sources (medication, fertiliser); the response team decides — never the screener alone. ⇒ وجد كاشف آثار المتفجرات أثرًا قائمًا على النترات في مسحة من حقيبة. احتجز الشخص والحقيبة، وأخلِ المنطقة واستدعِ فريق الاستجابة. قد تأتي الآثار من مصادر مشروعة (أدوية، أسمدة)؛ فريق الاستجابة يقرر — وليس المفتش وحده أبدًا.
Camera inference: a knife-like object visible in a person’s hand. Visual detection cannot see concealed objects; the officer decides. ⇒ استنتاج الكاميرا: جسم يشبه السكين ظاهر في يد شخص. الكشف البصري لا يرى الأجسام المخفية؛ الضابط يقرر.
A bag stayed in place for 60 s after its owner left the camera’s view. This is a behavioural indicator only; it says nothing about the bag’s contents. ⇒ بقيت حقيبة في مكانها 60 ثانية بعد مغادرة مالكها مجال رؤية الكاميرا. هذا مؤشر سلوكي فقط؛ ولا يدل على محتويات الحقيبة.
Pose-estimation inference: rapid, repeated limb movement between two people standing close, for 4 s. Needs human verification. ⇒ استنتاج تقدير الوضعية: حركة أطراف سريعة ومتكررة بين شخصين متقاربين لمدة 4 ثوانٍ. يحتاج تحققًا بشريًا.
3 denied attempts at A1 with card C-1088 within 2 minutes, then the person stayed near the gate for 90 s. The assessment is based on events and behaviour, not on appearance. ⇒ 3 محاولات مرفوضة عند A1 بالبطاقة C-1088 خلال دقيقتين، ثم بقي الشخص قرب البوابة 90 ثانية. التقييم مبني على الأحداث والسلوك، لا على المظهر.
Camera inference: a person stayed 75 s near the Level 4 door (limit 60 s) with no badge event at C1. ⇒ استنتاج الكاميرا: بقي شخص 75 ثانية قرب باب المستوى 4 (الحد 60 ثانية) دون حدث شارة عند C1.
Camera inference: an object inside staff-only zone B3 for 3 s. No matching card + PIN event for Level 4. ⇒ استنتاج الكاميرا: جسم داخل منطقة الموظفين B3 لمدة 3 ثوانٍ. لا يوجد حدث بطاقة + PIN مطابق للمستوى 4.
Camera inference: the watchtower PTZ and perimeter camera P1 tracked a person climbing over the east fence between the gates. No gate, card or barrier event matches the crossing. ⇒ استنتاج الكاميرا: تتبعت كاميرا برج المراقبة PTZ وكاميرا المحيط P1 شخصًا يتسلق السياج الشرقي بين البوابات. لا يوجد حدث بوابة أو بطاقة أو حاجز يطابق العبور.
VOC index rose from 100 to 245 in 40 s (threshold 200) while humidity stayed stable. This shows a change in air quality; it does not identify any substance. ⇒ ارتفع مؤشر المركبات العضوية المتطايرة من 100 إلى 245 خلال 40 ثانية (الحد 200) بينما بقيت الرطوبة مستقرة. هذا يُظهر تغيرًا في جودة الهواء؛ ولا يحدد أي مادة.
Proactive detection: the same person (re-identified by appearance, not by face) passed cameras P2, T-1, CAM-2 and P1 within 7 minutes, covering three quarters of a lap around the site and stopping twice at the fence without approaching any gate. Circling and repeated stops are typical of hostile reconnaissance. Send a guard to engage politely and ask what they need; nobody has broken in. ⇒ كشف استباقي: مرّ الشخص نفسه (أُعيد التعرف عليه بالمظهر لا بالوجه) أمام الكاميرات P2 وT-1 وCAM-2 وP1 خلال 7 دقائق، قاطعًا ثلاثة أرباع دورة حول الموقع ومتوقفًا مرتين عند السياج دون الاقتراب من أي بوابة. الدوران والتوقف المتكرر من سمات الاستطلاع العدائي. أرسل حارسًا للتحدث معه بلباقة وسؤاله عما يحتاج؛ لم يقتحم أحد.
A multirotor drone is broadcasting Remote ID (ASTM F3411) as serial 1581F5FKD229400A, 120 m from the site at 60 m above take-off, heading towards the building. The broadcast also gives the operator position, 400 m away on the street side. Inform the response team; drones are not allowed over the site. ⇒ مسيّرة متعددة المراوح تبث المعرّف عن بُعد (ASTM F3411) بالرقم التسلسلي 1581F5FKD229400A، على بعد 120 م من الموقع وبارتفاع 60 م فوق نقطة الإقلاع، متجهة نحو المبنى. يتضمن البث أيضًا موقع المشغّل على بعد 400 م من جهة الشارع. أبلغ فريق الاستجابة؛ المسيّرات غير مسموح بها فوق الموقع.
A Bluetooth device advertising as “Flipper 7Ghost” — a multi-tool that can read and clone access cards and spam phones — is inside the gate zone. Find and confiscate it; authorize it only if it belongs to your own security team. ⇒ جهاز بلوتوث يعلن عن نفسه باسم «Flipper 7Ghost» — أداة متعددة يمكنها قراءة بطاقات الدخول واستنساخها وإغراق الهواتف — داخل نطاق البوابة. ابحث عنه وصادره؛ ولا تصرّح له إلا إذا كان يعود لفريقك الأمني.
About 45 disconnect frames per second — normally fewer than 1. Phones and laptops near the gate are being knocked off Wi-Fi, often the first step of an evil-twin attack. The sender address can be forged; look for the device with the strongest signal. ⇒ نحو 45 إطار فصل اتصال في الثانية — والطبيعي أقل من 1. تُفصل الهواتف والحواسيب قرب البوابة عن Wi-Fi، وهي غالبًا الخطوة الأولى لهجوم نقطة الوصول المزيفة. يمكن تزوير عنوان المرسل؛ ابحث عن الجهاز ذي الإشارة الأقوى.
An unknown access point (DE:AD:BE:EF:00:01) is broadcasting “SAWN-Office”, the name of your authorized access point. People who connect to it can have their traffic captured. Locate it by signal strength and remove it. ⇒ نقطة وصول غير معروفة (DE:AD:BE:EF:00:01) تبث «SAWN-Office»، وهو اسم نقطة الوصول المصرّح بها لديك. من يتصل بها قد تُلتقط بياناته. حدد موقعها بقوة الإشارة وأزلها.
Wi-Fi traffic fell from ≈180 to 9 frames per second while the noise floor rose from −95 to −68 dBm, two reports in a row. Jamming is illegal and also blinds the sensor; use manual device checks at the gate until it stops. ⇒ انخفضت حركة Wi-Fi من ≈180 إلى 9 إطارات في الثانية بينما ارتفع مستوى الضجيج من −95 إلى −68 dBm، في تقريرين متتاليين. التشويش غير قانوني ويُعمي المستشعر أيضًا؛ استخدم التحقق اليدوي من الأجهزة عند البوابة حتى يتوقف.
≈160 different Bluetooth addresses advertised in 2 s (normally ≈15) — typical of a “BLE spam” tool that floods phones with fake pairing pop-ups and hides other devices. ⇒ ≈160 عنوان بلوتوث مختلف أعلنت خلال ثانيتين (الطبيعي ≈15) — نمط أداة «BLE spam» التي تغرق الهواتف بنوافذ اقتران مزيفة وتخفي الأجهزة الأخرى.

A device that is not in the authorization registry is inside the gate zone. Check the visitor: mark the device authorized (supervisor) or unauthorized, or ask the visitor to leave it. ⇒ جهاز غير موجود في سجل التصاريح داخل نطاق البوابة. تحقق من الزائر: صنّف الجهاز كمصرّح (مشرف) أو غير مصرّح، أو اطلب من الزائر تركه.
A live device matched the alert rule “{0}”. ⇒ تطابق جهاز مباشر مع قاعدة التنبيه «{0}».
{0}. The device is denied in the authorization registry, the sensor is trusted and the address is stable, so this is a verified detection. ⇒ {0}. الجهاز مرفوض في سجل التصاريح، والمستشعر موثوق، والعنوان ثابت، لذا فهذا اكتشاف مؤكد.
Evidence: {0} ⇒ الأدلة: {0}
Vendor: {0} ⇒ المصنّع: {0}
Inside the gate zone ({0} dBm Wi-Fi / {1} dBm Bluetooth) for {2} reading(s) ⇒ داخل نطاق البوابة ({0} dBm Wi-Fi / {1} dBm بلوتوث) لمدة {2} قراءة
Signal {0} dBm (median of recent readings) at sensor {1} ⇒ الإشارة {0} dBm (وسيط القراءات الأخيرة) عند المستشعر {1}
Signal {0} dBm at {1} ⇒ الإشارة {0} dBm عند {1}
Unauthorized device (recorded offline) ⇒ جهاز غير مصرّح (مسجّل دون اتصال)
rule matched ⇒ تطابقت القاعدة
inside the gate zone ⇒ داخل نطاق البوابة
denied device detected ⇒ اكتُشف جهاز مرفوض
first heard {0} ⇒ أول التقاط {0}
Drone entered the {0} m radius ({1} m from the site) ⇒ دخلت المسيّرة نطاق {0} م ({1} م من الموقع)
Serial / ID: {0} ⇒ الرقم التسلسلي / المعرّف: {0}
Speed: {0} m/s, heading {1}° ⇒ السرعة: {0} م/ث، الاتجاه {1}°
Status: {0} ⇒ الحالة: {0}
Rogue BSSID {0} ⇒ BSSID دخيل {0}
Noise {0} vs ≈{1} dBm ⇒ الضجيج {0} مقابل ≈{1} dBm
Traffic {0} vs ≈{1} frames/s ⇒ الحركة {0} مقابل ≈{1} إطار/ث

Incident acknowledged ⇒ تم استلام الحادثة
Incident confirmed ⇒ تم تأكيد الحادثة
Incident created ⇒ أُنشئت الحادثة
Incident reopened ⇒ أُعيد فتح الحادثة
Incident is already closed ⇒ الحادثة مغلقة بالفعل
Incident not found ⇒ الحادثة غير موجودة
Escalated to supervisor ⇒ صُعّدت إلى المشرف
Dismissed as false alarm ⇒ استُبعدت كإنذار كاذب
Waiting for the shift supervisor ⇒ بانتظار مشرف المناوبة
This incident was escalated — a shift supervisor decides it. ⇒ صُعّدت هذه الحادثة — يقرر فيها مشرف المناوبة.
Note added ⇒ أُضيفت ملاحظة
Note is empty ⇒ الملاحظة فارغة
Evidence attached ⇒ أُرفقت الأدلة
Drone dispatched ⇒ أُرسلت المسيّرة
Drone recalled ⇒ استُدعيت المسيّرة
Manual recall ⇒ استدعاء يدوي
Training scenario run ⇒ تشغيل سيناريو تدريبي
Opened in the console ⇒ فُتح في وحدة التحكم
Dismiss {0} “{1}” as a false alarm: {2} ⇒ استبعاد {0} «{1}» كإنذار كاذب: {2}
{0} dismissed: {1} ⇒ استُبعدت {0}: {1}
{0} · {1} (simulated) ⇒ {0} · {1} (محاكاة)
{0} ({1}, simulated) ⇒ {0} ({1}، محاكاة)
Signed in ⇒ سجّل الدخول
Aircraft feed mode set ⇒ تغيير وضع تغذية الطائرات
Approved but not applied ⇒ وُوفق عليه ولم يُنفَّذ
Camera zone set ⇒ تحديد منطقة الكاميرا
Demo scenario started ⇒ بدء سيناريو العرض
Evidence clip saved ⇒ حفظ مقطع فيديو كدليل
Nashdan question ⇒ سؤال نشدان
Nashdan voice question ⇒ سؤال صوتي لنشدان
Physical NFC credential linked ⇒ ربط بطاقة NFC فعلية
Physical NFC credential unlinked ⇒ فك ربط بطاقة NFC فعلية
Recording added ⇒ إضافة تسجيل
Recording deleted ⇒ حذف تسجيل
Report generated ⇒ إنشاء تقرير
Incident resolved ⇒ حُلّت الحادثة
Policy approved and active ⇒ اعتماد السياسة وتفعيلها
Policy draft saved ⇒ حفظ مسودة السياسة
Policy draft discarded ⇒ تجاهل مسودة السياسة
Policy approval refused ⇒ رُفض اعتماد السياسة
The draft changed after you reviewed it: {0} is now revision {1}. Review the impact checks again. ⇒ تغيّرت المسودة بعد مراجعتك: {0} الآن في المراجعة {1}. راجع فحوص الأثر مجدداً قبل الاعتماد.
Two-person rule: {0} was edited by {1} — someone else with approval authority must approve it. ⇒ قاعدة الشخصين: عدّل المسودة {0} كلٌّ من {1}، فيعتمدها شخص آخر يملك صلاحية الاعتماد.
{0} cannot be approved yet: {1} ⇒ لا يمكن اعتماد {0} بعد: {1}
Two-person rule: {0} was edited by {1} — another supervisor or administrator must approve it. ⇒ قاعدة الشخصين: عدّل {1} المسودة {0}، فيجب أن يعتمدها مشرف أو مدير آخر.
Incidents confirmed ⇒ الحوادث المؤكدة
Incidents dismissed ⇒ الحوادث المستبعدة كإنذار كاذب
Incidents resolved ⇒ الحوادث المحلولة
The NFC reader records physical card presentations and can identify an enrolled card holder. Face, metal, ETD and door feedback are not connected, so SAWN cannot confirm an entry yet. ⇒ قارئ NFC يسجّل تمرير البطاقات الفعلية ويتعرّف على حامل بطاقة مسجّلة. الوجه والمعادن وكاشف المتفجرات وتغذية الباب غير مربوطة، لذا لا تستطيع صون تأكيد الدخول بعد.
The Level 5 NFC reader records a card identity factor only. Face, PIN, fingerprint, alarm and door feedback remain required; SAWN cannot grant or confirm entry. ⇒ قارئ المستوى 5 يسجّل عامل البطاقة فقط. الوجه والرمز السري والبصمة والإنذار وتغذية الباب ما زالت مطلوبة؛ لا تستطيع صون منح الدخول أو تأكيده.
No Level 5 reader link is open yet. Face, PIN, fingerprint, alarm and door-controller connections are not integrated. ⇒ لا يوجد اتصال مفتوح بقارئ المستوى 5 بعد. الوجه والرمز السري والبصمة والإنذار ووحدة تحكم الباب غير مربوطة.
NFC reader ⇒ قارئ NFC
Face recognition ⇒ مطابقة الوجه
Metal detector ⇒ كاشف المعادن
Explosive trace (ETD) ⇒ كاشف آثار المتفجرات (ETD)
Airspace & wireless ⇒ المجال الجوي والأجهزة اللاسلكية
PIN verification ⇒ التحقق بالرمز السري
Fingerprint verification ⇒ التحقق بالبصمة
Lock, door contact & feedback ⇒ القفل وحسّاس الباب والتغذية الراجعة
Level 5 alarm / LED / buzzer ⇒ إنذار المستوى 5 / المؤشر / الجرس
No Gate A reader connection ⇒ لا يوجد اتصال بقارئ البوابة A
No Level 5 reader connection ⇒ لا يوجد اتصال بقارئ المستوى 5
No camera integration ⇒ لا يوجد ربط بكاميرا
No detector integration ⇒ لا يوجد ربط بكاشف
No keypad/controller integration ⇒ لا يوجد ربط بلوحة مفاتيح أو وحدة تحكم
No biometric integration ⇒ لا يوجد ربط ببصمة
No door-controller integration ⇒ لا يوجد ربط بوحدة تحكم الباب
No Level 5 controller integration ⇒ لا يوجد ربط بوحدة تحكم المستوى 5
AS-1 ESP32 ⇒ AS-1 ESP32
Required for the intended Gate A flow, but not connected yet. ⇒ مطلوب لمسار البوابة A المقصود، لكنه غير مربوط بعد.
Manual screening is required until a detector input is connected. ⇒ يلزم تفتيش يدوي حتى يُربط الكاشف.
Deferred hardware; training inputs are kept separately from Gate A live activity. ⇒ جهاز مؤجّل؛ مدخلات التدريب منفصلة عن نشاط البوابة A الحي.
Required by the intended flow, but not implemented yet. ⇒ مطلوب في المسار المقصود، لكنه غير منفّذ بعد.
No PIN event path exists yet. ⇒ لا يوجد مسار لأحداث الرمز السري بعد.
No biometric event path exists yet. ⇒ لا يوجد مسار لأحداث البصمة بعد.
SAWN cannot command or confirm the Level 5 door. ⇒ لا تستطيع صون التحكم بباب المستوى 5 أو تأكيد حالته.
No alarm or indicator event path exists yet. ⇒ لا يوجد مسار لأحداث الإنذار أو المؤشرات بعد.
Airspace sensor is not reporting; Gate A wireless checks require a manual check. ⇒ حسّاس المجال الجوي لا يرسل؛ فحص الأجهزة اللاسلكية في البوابة A يحتاج تحققاً يدوياً.
{0} reporting at Gate A. ⇒ {0} يرسل في البوابة A.
No open reader link. Last accepted NFC tap was {0} s ago. ⇒ لا يوجد اتصال مفتوح بالقارئ. آخر تمرير مقبول قبل {0} ث.
No open link for the {0} NFC reader. ⇒ لا يوجد اتصال مفتوح بقارئ NFC في {0}.
Gate A ⇒ البوابة A
Gate B · Level 5 ⇒ البوابة B · المستوى 5
{0} ESP32 · Wi-Fi ⇒ {0} ESP32 · واي فاي
{0} ESP32 · serial ⇒ {0} ESP32 · منفذ تسلسلي
Possible match: employee without access to this area (face matching, needs review) ⇒ تطابق محتمل: موظف بلا صلاحية لهذه المنطقة (مطابقة الوجوه، يحتاج مراجعة)
No enrolled match at a face matching camera (needs review) ⇒ لا تطابق مع أي موظف مسجّل عند كاميرا مطابقة الوجوه (يحتاج مراجعة)
Face spoofing attempt: photo or screen at the camera ⇒ محاولة انتحال وجه: صورة أو شاشة أمام الكاميرا
Signed out ⇒ سجّل الخروج
Failed sign-in ⇒ فشل تسجيل الدخول
Initial setup ⇒ الإعداد الأولي
First administrator created ⇒ أُنشئ أول مدير
Changed own password ⇒ غيّر كلمة المرور الخاصة به
User created ⇒ أُنشئ مستخدم
User updated ⇒ حُدّث مستخدم
User deleted ⇒ حُذف مستخدم
Account disabled ⇒ الحساب معطّل
Person added ⇒ أُضيف شخص
Person updated ⇒ حُدّث شخص
Person removed ⇒ أُزيل شخص
Person suspended ⇒ أُوقف شخص
Person reinstated ⇒ أُعيد تفعيل شخص
Card issued ⇒ صدرت بطاقة
Card revoked ⇒ أُلغيت بطاقة
Card suspended ⇒ أُوقفت بطاقة
Card reactivated ⇒ أُعيد تفعيل بطاقة
Card deleted ⇒ حُذفت بطاقة
Card status ⇒ حالة البطاقة
Card holder ⇒ حامل البطاقة
Access review completed ⇒ اكتملت مراجعة الصلاحية
Device authorized ⇒ صُرّح للجهاز
Device marked unauthorized ⇒ صُنّف الجهاز كغير مصرّح
Device registration removed ⇒ أُزيل تسجيل الجهاز
Device authorization updated ⇒ حُدّث تصريح الجهاز
Sensor trusted ⇒ وُثّق المستشعر
Sensor untrusted ⇒ أُلغي توثيق المستشعر
Alert rule created ⇒ أُنشئت قاعدة تنبيه
Alert rule edited ⇒ عُدّلت قاعدة تنبيه
Alert rule deleted ⇒ حُذفت قاعدة تنبيه
Alert rule enabled ⇒ فُعّلت قاعدة تنبيه
Alert rule disabled ⇒ عُطّلت قاعدة تنبيه
Site settings changed ⇒ تغيّرت إعدادات الموقع
Site location set ⇒ عُيّن موقع المنشأة
USB port released for flashing ⇒ حُرّر منفذ USB للبرمجة
Local network scan ⇒ فحص الشبكة المحلية
Network cut (simulated) ⇒ انقطاع الشبكة (محاكاة)
Network restored (simulated) ⇒ عادت الشبكة (محاكاة)
Nodes running over USB ⇒ العُقد تعمل عبر USB
Back on Wi-Fi ⇒ عاد إلى Wi-Fi
Authorised entry (simulated) ⇒ دخول مصرّح (محاكاة)
Airspace checkpoint ⇒ نقطة تفتيش المجال الجوي
Approval requested ⇒ طُلبت موافقة
Approval rejected ⇒ رُفضت الموافقة
Approval request expired ⇒ انتهت صلاحية طلب الموافقة
Approval request withdrawn ⇒ سُحب طلب الموافقة
Approved (two-person rule) ⇒ تمت الموافقة (قاعدة الشخصين)
Approved: {0} ⇒ تمت الموافقة: {0}
Rejected: {0} ⇒ رُفض: {0}
Second approval needed: {0} ⇒ مطلوب موافقة ثانية: {0}
Withdrawn by the requester ⇒ سحبه مقدّم الطلب
Request expired — ask again ⇒ انتهت صلاحية الطلب — اطلب مجددًا
Request is already {0} ⇒ الطلب بالفعل {0}
Request not found ⇒ الطلب غير موجود
Two-person rule: someone else must approve your own request. ⇒ قاعدة الشخصين: يجب أن يوافق شخص آخر على طلبك.
Approving this needs {0} or higher. ⇒ الموافقة على هذا تتطلب {0} أو أعلى.
Only the person who asked can withdraw a request ⇒ فقط مقدّم الطلب يمكنه سحبه
Two-person rule changed ⇒ تغيّرت قاعدة الشخصين
{0}: second approver ⇒ {0}: موافق ثانٍ
{0}: single person ⇒ {0}: شخص واحد
Dismiss a critical incident ⇒ استبعاد حادثة حرجة
Reactivate a revoked or suspended card ⇒ إعادة تفعيل بطاقة ملغاة أو موقوفة
Restore access that ended or was removed ⇒ استعادة صلاحية انتهت أو أُزيلت
Could not apply: {0} ⇒ تعذّر التطبيق: {0}
{0} · requested by {1} · {2} ⇒ {0} · طلبه {1} · {2}
{0} (by {1}) ⇒ {0} (بواسطة {1})
Restore access for {0} until {1} ⇒ استعادة صلاحية {0} حتى {1}
no end date ⇒ بدون تاريخ انتهاء
Open Gate A for {0} although the system said {1} ⇒ فتح البوابة A لـ {0} رغم أن النظام قرر {1}
unknown person ⇒ شخص غير معروف
Gate opened by override (single person) ⇒ فُتحت البوابة بالتجاوز (شخص واحد)
Give the reason for opening the gate against the system’s decision ⇒ اذكر سبب فتح البوابة خلافًا لقرار النظام
This check already allowed entry ⇒ هذا الفحص سمح بالدخول بالفعل
Gate check not found ⇒ فحص البوابة غير موجود
Checkpoint policy changed ⇒ تغيّرت سياسة نقطة التفتيش
Gate A check #{0}: {1} ⇒ فحص البوابة A رقم {0}: {1}
Gate A: {0} ⇒ البوابة A: {0}

Wrong user name or password. ⇒ اسم المستخدم أو كلمة المرور غير صحيحة.
Wrong password ⇒ كلمة مرور خاطئة
Current password is wrong. ⇒ كلمة المرور الحالية غير صحيحة.
Too many failed sign-ins. Try again in {0} s. ⇒ محاولات دخول فاشلة كثيرة. حاول مجددًا بعد {0} ثانية.
Please sign in. ⇒ يرجى تسجيل الدخول.
Session ended ⇒ انتهت الجلسة
Setup is already complete — sign in instead. ⇒ الإعداد مكتمل بالفعل — سجّل الدخول بدلًا من ذلك.
Password is too long ⇒ كلمة المرور طويلة جدًا
Password must be at least {0} characters ⇒ يجب ألا تقل كلمة المرور عن {0} أحرف
Password must not contain the user name ⇒ يجب ألا تحتوي كلمة المرور على اسم المستخدم
User name: 3–32 letters, digits, dot, dash or underscore ⇒ اسم المستخدم: من 3 إلى 32 حرفًا أو رقمًا أو نقطة أو شرطة أو شرطة سفلية
User name “{0}” is taken ⇒ اسم المستخدم «{0}» مستخدم
User not found ⇒ المستخدم غير موجود
Invalid role ⇒ دور غير صالح
Choose a role ⇒ اختر دورًا
At least one active administrator must remain. ⇒ يجب أن يبقى مدير نشط واحد على الأقل.
You cannot delete your own account. ⇒ لا يمكنك حذف حسابك.
Forbidden ⇒ ممنوع
Not found ⇒ غير موجود
Bad request ⇒ طلب غير صالح
Internal error ⇒ خطأ داخلي
Invalid JSON ⇒ JSON غير صالح
JSON required ⇒ يتطلب JSON
Method not allowed ⇒ الطريقة غير مسموحة
Request too large ⇒ الطلب كبير جدًا
Origin not allowed ⇒ المصدر غير مسموح
Unknown action ⇒ إجراء غير معروف
Unknown drone action ⇒ إجراء مسيّرة غير معروف
Unknown scenario ⇒ سيناريو غير معروف
Unknown component ⇒ مكوّن غير معروف
Person not found ⇒ الشخص غير موجود
Card not found ⇒ البطاقة غير موجودة
Asset not found ⇒ الأصل غير موجود
Sign not found ⇒ اللافتة غير موجودة
Name is required ⇒ الاسم مطلوب
Invalid end date ⇒ تاريخ انتهاء غير صالح
The end date is in the past ⇒ تاريخ الانتهاء في الماضي
The new end date is in the past ⇒ تاريخ الانتهاء الجديد في الماضي
The selected owner no longer exists ⇒ المالك المحدد لم يعد موجودًا
The sponsor must be an active console user ⇒ يجب أن يكون الكفيل مستخدمًا نشطًا لوحدة التحكم
Choose a sponsor: the employee responsible for this person, who is notified about their access. ⇒ اختر كفيلًا: الموظف المسؤول عن هذا الشخص، والذي يُبلَّغ بصلاحياته.
Visitors need an access end date — access is removed automatically when it passes. ⇒ الزوار يحتاجون تاريخ انتهاء للصلاحية — تُزال الصلاحية تلقائيًا عند انقضائه.
Contractors need an access end date — access is removed automatically when it passes. ⇒ المقاولون يحتاجون تاريخ انتهاء للصلاحية — تُزال الصلاحية تلقائيًا عند انقضائه.
Visitor access can last at most {0} days. ⇒ صلاحية الزائر لا تتجاوز {0} يومًا.
Contractor access can last at most {0} days. ⇒ صلاحية المقاول لا تتجاوز {0} يومًا.
Access level must be 1–5 ⇒ مستوى الصلاحية يجب أن يكون من 1 إلى 5
Card {0} already exists ⇒ البطاقة {0} موجودة بالفعل
Card number must look like C-1234 ⇒ رقم البطاقة يجب أن يكون بصيغة C-1234
Invalid card status ⇒ حالة بطاقة غير صالحة
Status must be active or suspended ⇒ الحالة يجب أن تكون نشطة أو موقوفة
Type must be staff, contractor or visitor ⇒ النوع يجب أن يكون موظفًا أو مقاولًا أو زائرًا
A reason is required to deny a device ⇒ السبب مطلوب لرفض جهاز
Device identifier and protocol are required ⇒ معرّف الجهاز والبروتوكول مطلوبان
A scan ran less than a minute ago. ⇒ أُجري فحص قبل أقل من دقيقة.
Latitude −90…90, longitude −180…180, radius 50–20000 m ⇒ خط العرض −90…90، خط الطول −180…180، نصف القطر 50–20000 م
Choose service, test, repair or fault ⇒ اختر صيانة أو اختبارًا أو إصلاحًا أو عطلًا
Invalid sign status ⇒ حالة لافتة غير صالحة
{0}'s access has ended — restore their access first (needs a second approver), then issue a new card. ⇒ انتهت صلاحية {0} — استعد صلاحيته أولًا (يتطلب موافقًا ثانيًا)، ثم أصدر بطاقة جديدة.
Sample record — replace with your real staff list. ⇒ سجل نموذجي — استبدله بقائمة موظفيك الحقيقية.

You are the sponsor of {0} ⇒ أنت كفيل {0}
Access ended — removed automatically ⇒ انتهت الصلاحية — أُزيلت تلقائيًا
Access ended: {0} ⇒ انتهت الصلاحية: {0}
{0}'s access ended ⇒ انتهت صلاحية {0}
{0}'s access ends within 24 h ⇒ تنتهي صلاحية {0} خلال 24 ساعة
Access ends {0} and will be removed automatically. ⇒ تنتهي الصلاحية {0} وستُزال تلقائيًا.
Cards revoked and device authorizations lifted. If they still need access, request an extension (a second approver is needed). ⇒ أُلغيت البطاقات وسُحبت تصاريح الأجهزة. إذا كان لا يزال يحتاج الصلاحية، اطلب تمديدًا (يتطلب موافقًا ثانيًا).
{0} device authorization(s) lifted ⇒ سُحب {0} تصريح جهاز
{0} device authorization(s) applied ⇒ طُبّق {0} تصريح جهاز
{0} reactivated ⇒ أُعيد تفعيل {0}
Do not open manually: {0} ⇒ لا تفتح يدويًا: {0}
{0} is at Gate A with expired access ⇒ {0} عند البوابة A بصلاحية منتهية
{0} tried to enter after their access ended. Expect requests like “I forgot, please let me in”: do not open the gate or let them follow someone in. Their sponsor has been told. ⇒ حاول {0} الدخول بعد انتهاء صلاحيته. توقّع طلبات مثل «نسيت، اسمح لي بالدخول»: لا تفتح البوابة ولا تسمح له بالدخول خلف أحد. تم إبلاغ كفيله.
Expired access at Gate A — possible social engineering. Refer them to their sponsor. ⇒ صلاحية منتهية عند البوابة A — هندسة اجتماعية محتملة. أحِله إلى كفيله.
Expired access presented — possible social engineering ⇒ قُدّمت صلاحية منتهية — هندسة اجتماعية محتملة
Presented a badge after their access ended ⇒ قدّم شارة بعد انتهاء صلاحيته
Their access ended and was removed automatically. If they still need access, request an extension (needs a second approver). Do not ask the guard to open the gate. ⇒ انتهت صلاحيته وأُزيلت تلقائيًا. إذا كان لا يزال يحتاجها، اطلب تمديدًا (يتطلب موافقًا ثانيًا). لا تطلب من الحارس فتح البوابة.
Insider risk elevated ⇒ ارتفاع خطر التهديد الداخلي
Insider risk elevated: {0} ⇒ ارتفاع خطر التهديد الداخلي: {0}
Score {0} — review their recent activity. ⇒ الدرجة {0} — راجع نشاطه الأخير.
Score crossed {0} ⇒ تجاوزت الدرجة {0}
Entered at {0} (outside {1}:00–{2}:00) ⇒ دخل في {0} (خارج {1}:00–{2}:00)
Card used by someone whose face does not match ⇒ بطاقة استخدمها شخص لا يطابق وجهه
{0} · {1} · cleared to Level {2}. ⇒ {0} · {1} · مصرّح حتى المستوى {2}.
{0} · {1} · cleared to Level {2} · escort required beyond reception. ⇒ {0} · {1} · مصرّح حتى المستوى {2} · يتطلب مرافقًا بعد الاستقبال.
{0} is cleared to Level {1}, not Level {2}. ⇒ {0} مصرّح حتى المستوى {1}، وليس المستوى {2}.
{0} is suspended. ⇒ {0} موقوف.
{0}'s access ended {1} and was removed automatically. Do not open manually — refer them to their sponsor. ⇒ انتهت صلاحية {0} في {1} وأُزيلت تلقائيًا. لا تفتح يدويًا — أحِله إلى كفيله.
Card {0} is not known. ⇒ البطاقة {0} غير معروفة.
Card {0} is {1}. ⇒ البطاقة {0} {1}.
Card {0} is not assigned to anyone. ⇒ البطاقة {0} غير مخصصة لأحد.
Badge reader is down — officer checks the ID and looks the person up manually. ⇒ قارئ الشارات معطّل — يتحقق الضابط من الهوية ويبحث عن الشخص يدويًا.
Central directory unreachable and the local copy is older than {0} h — identity cannot be verified (fail-secure). ⇒ الدليل المركزي غير متاح والنسخة المحلية أقدم من {0} ساعة — لا يمكن التحقق من الهوية (إغلاق آمن).
Face camera is down — officer compares the person with the ID photo. ⇒ كاميرا الوجه معطّلة — يقارن الضابط الشخص بصورة الهوية.
Face does not match the card holder ⇒ الوجه لا يطابق حامل البطاقة
Face does not match the card holder (score {0} < {1}). Possible borrowed or cloned card. ⇒ الوجه لا يطابق حامل البطاقة (الدرجة {0} < {1}). بطاقة مستعارة أو مستنسخة محتملة.
Matches the enrolled face (score {0}). ⇒ يطابق الوجه المسجّل (الدرجة {0}).
No enrolled face for {0} — manual ID check, then enrol the face. ⇒ لا يوجد وجه مسجّل لـ {0} — تحقق يدوي من الهوية، ثم سجّل الوجه.
The face at Gate A does not match {0}'s enrolled face. Possible borrowed, stolen or cloned card. Hold the person and check their ID. ⇒ الوجه عند البوابة A لا يطابق الوجه المسجّل لـ {0}. بطاقة مستعارة أو مسروقة أو مستنسخة محتملة. احتجز الشخص وتحقق من هويته.
Metal detector is down — manual search. ⇒ كاشف المعادن معطّل — تفتيش يدوي.
Metal object detected — secondary search before entry. The detector does not identify the object. ⇒ اكتُشف جسم معدني — تفتيش ثانوي قبل الدخول. الكاشف لا يحدد الجسم.
Metal alarm at the checkpoint ⇒ إنذار معادن عند نقطة التفتيش
No metal alarm. ⇒ لا يوجد إنذار معادن.
Switched-off electronic device detected — switch it on and re-scan so the airspace sensor can check it. ⇒ اكتُشف جهاز إلكتروني مطفأ — شغّله وأعد الفحص ليتمكن مستشعر المجال الجوي من فحصه.
Explosive trace at the checkpoint ⇒ آثار متفجرات عند نقطة التفتيش
Explosive trace detected at the checkpoint ⇒ اكتُشفت آثار متفجرات عند نقطة التفتيش
Explosive trace detected on the swab — hold the person and the bag, call the response team. ⇒ اكتُشفت آثار متفجرات في المسحة — احتجز الشخص والحقيبة، واستدعِ فريق الاستجابة.
No trace. ⇒ لا توجد آثار.
No wireless device in the gate zone. ⇒ لا يوجد جهاز لاسلكي في نطاق البوابة.
{0} device(s) in the gate zone, all authorized for Level {1}. ⇒ {0} جهاز في نطاق البوابة، جميعها مصرّح بها للمستوى {1}.
{0} is not registered ⇒ {0} غير مسجّل
{0} is UNAUTHORIZED: {1} ⇒ {0} غير مصرّح: {1}
{0}: {1} — medical device: confirm with the person, do not confiscate ⇒ {0}: {1} — جهاز طبي: تحقق مع الشخص، لا تصادره
{0}: {1} — not allowed at any level ⇒ {0}: {1} — غير مسموح به في أي مستوى
{0} ({1} % sure) ⇒ {0} (مؤكد بنسبة {1}٪)
Level {0} still required ⇒ لا يزال المستوى {0} مطلوبًا
No sensor heartbeat — gate devices are checked by hand ⇒ لا توجد نبضة من المستشعر — يُتحقق من أجهزة البوابة يدويًا
Silent for {0} s — gate devices are checked by hand ⇒ صامت منذ {0} ثانية — يُتحقق من أجهزة البوابة يدويًا
{0} reporting ⇒ {0} يرسل البيانات
Down (simulated failure) — its checkpoint stage refers to an officer ⇒ معطّل (عطل محاكى) — تُحال مرحلته في نقطة التفتيش إلى ضابط
Unreachable (simulated) — the gate uses its local copy ⇒ غير متاح (محاكاة) — تستخدم البوابة نسختها المحلية
Reachable ⇒ متاح
Responding ⇒ يستجيب
Not created yet ⇒ لم يُنشأ بعد
No backup yet ⇒ لا توجد نسخة احتياطية بعد
Last backup {0} (7 kept) ⇒ آخر نسخة احتياطية {0} (يُحتفظ بـ 7)
No console open — incidents are stored but nobody sees them live ⇒ لا توجد وحدة تحكم مفتوحة — تُحفظ الحوادث لكن لا أحد يراها مباشرة
{0} open ⇒ {0} مفتوحة
Consoles watching ⇒ وحدات التحكم المتابعة
{0} people, {1} min old ⇒ {0} شخص، عمرها {1} دقيقة
{0} people, {1} min old — too old, the gate fails secure ⇒ {0} شخص، عمرها {1} دقيقة — قديمة جدًا، البوابة تُغلق بأمان
Health check: {0} {1} → down ⇒ فحص الصحة: {0} {1} ← معطّل
{0} failure ⇒ عطل {0}
{0} is down ⇒ {0} معطّل
Component recovered ⇒ تعافى المكوّن
Component failed (simulated) ⇒ تعطل المكوّن (محاكاة)
Component restored (simulated) ⇒ استُعيد المكوّن (محاكاة)
Daily backup ⇒ النسخ الاحتياطي اليومي
Database ⇒ قاعدة البيانات
Database backup ⇒ نسخة احتياطية لقاعدة البيانات
In-memory database ⇒ قاعدة بيانات في الذاكرة
In-memory database — nothing to back up ⇒ قاعدة بيانات في الذاكرة — لا شيء للنسخ الاحتياطي
Central directory ⇒ الدليل المركزي
Local directory copy ⇒ النسخة المحلية من الدليل
Local directory copy refreshed ⇒ تم تحديث النسخة المحلية من الدليل
Central directory is unreachable — the local copy cannot be refreshed ⇒ الدليل المركزي غير متاح — لا يمكن تحديث النسخة المحلية
Central directory cut (simulated) ⇒ انقطاع الدليل المركزي (محاكاة)
Central directory restored (simulated) ⇒ استُعيد الدليل المركزي (محاكاة)
Gate A runs on its local directory copy ⇒ البوابة A تعمل على نسختها المحلية من الدليل
Sensor link ⇒ اتصال المستشعر
Airspace & wireless sensor (ESP32) ⇒ مستشعر المجال الجوي واللاسلكي (ESP32)
Badge reader + local directory copy ⇒ قارئ الشارات + النسخة المحلية من الدليل
Gate badge reader ⇒ قارئ شارات البوابة
Face match against the enrolled face ⇒ مطابقة الوجه مع الوجه المسجّل
Metal detector (finds switched-off devices) ⇒ كاشف المعادن (يجد الأجهزة المطفأة)
Behaviour analytics: loitering, unattended objects, weapons ⇒ تحليلات السلوك: التسكّع، الأجسام المتروكة، الأسلحة
Watchtower 360° PTZ with AI climb and circling detection ⇒ برج المراقبة PTZ ‏360° مع كشف التسلق والدوران بالذكاء الاصطناعي
Watchtower PTZ + AI ⇒ برج المراقبة PTZ + ذكاء اصطناعي
Perimeter cameras P1–P3 ⇒ كاميرات المحيط P1–P3
Fence line with gates ⇒ خط السياج مع البوابات
Deter, detect and delay before anyone reaches the building ⇒ الردع والكشف والتأخير قبل وصول أي شخص إلى المبنى
Approach ⇒ الاقتراب
Spot hostile reconnaissance and odd behaviour early ⇒ رصد الاستطلاع العدائي والسلوك الغريب مبكرًا
Only the right person, with nothing dangerous and only allowed devices ⇒ الشخص الصحيح فقط، دون أي شيء خطر، وبالأجهزة المسموح بها فقط
Building levels ⇒ مستويات المبنى
Each level needs more factors ⇒ كل مستوى يتطلب عوامل تحقق أكثر
Cards for Levels 1–3, card + PIN for Level 4 ⇒ بطاقات للمستويات 1–3، بطاقة + PIN للمستوى 4
Critical rooms ⇒ الغرف الحرجة
Individual authorization only ⇒ تصريح فردي فقط
Level 5: card + PIN + fingerprint ⇒ المستوى 5: بطاقة + PIN + بصمة
Escort rule for visitors ⇒ قاعدة المرافقة للزوار
People & access ⇒ الأشخاص والصلاحيات
Signage ⇒ اللافتات
Warning signage (fence, armed response, CCTV) ⇒ لافتات التحذير (السياج، الاستجابة المسلحة، كاميرات المراقبة)
Vehicle checkpoint signage and barriers ⇒ لافتات وحواجز نقطة تفتيش المركبات
All required signs installed and inspected ⇒ جميع اللافتات المطلوبة مركّبة ومفحوصة
{0} sign(s) need attention ⇒ {0} لافتة تحتاج إلى انتباه
Hazard warning missing/damaged: {0} — the measure it warns about must not be relied on until fixed ⇒ تحذير خطر مفقود/تالف: {0} — لا يُعتمد على الإجراء الذي يحذّر منه حتى يُصلح
Hazard sign {0}: {1} ⇒ لافتة الخطر {0}: {1}
Sign inspected ⇒ فُحصت اللافتة
Maintenance ⇒ الصيانة
Maintenance: {0} ⇒ الصيانة: {0}
Service overdue ⇒ الصيانة متأخرة
Daily function test due ⇒ اختبار التشغيل اليومي مستحق
Nothing overdue ⇒ لا شيء متأخر
{0} asset(s) overdue ⇒ {0} أصل متأخر
{0} service is OVERDUE ⇒ صيانة {0} متأخرة
{0} service is due within 14 days ⇒ صيانة {0} مستحقة خلال 14 يومًا
{0} · {1} · last serviced {2} ⇒ {0} · {1} · آخر صيانة {2}
Service recorded ⇒ سُجّلت الصيانة
Repair recorded ⇒ سُجّل الإصلاح
Fault reported ⇒ أُبلغ عن عطل
Function test passed ⇒ نجح اختبار التشغيل
Function test FAILED ⇒ فشل اختبار التشغيل
{0}: fault reported ⇒ {0}: أُبلغ عن عطل
Face-recognition camera ⇒ كاميرا التعرف على الوجه
Walk-through metal detector ⇒ بوابة كشف المعادن
Behaviour camera (sidewalk) ⇒ كاميرا السلوك (الرصيف)
UPS (gate and console power) ⇒ مزود طاقة احتياطي (للبوابة ووحدة التحكم)
CCTV and 360° monitoring in operation (operator: SAWN Security). ⇒ المراقبة بالكاميرات و360° تعمل (المشغّل: أمن SAWN).
DANGER — Electric fence. Do not touch or climb. ⇒ خطر — سياج كهربائي. لا تلمسه ولا تتسلقه.
WARNING — Armed security. Intruders will be stopped. ⇒ تحذير — أمن مسلح. سيتم إيقاف المتسللين.
Exclusion area — individual authorization only. Card + PIN + fingerprint. ⇒ منطقة حصرية — تصريح فردي فقط. بطاقة + PIN + بصمة.
Limited area — authorized personnel only. Visitors must be escorted. ⇒ منطقة محدودة — للمصرّح لهم فقط. يجب مرافقة الزوار.
Prohibited: weapons, explosives, sharp objects. Items are detected even when switched off. ⇒ يُمنع: الأسلحة والمتفجرات والأدوات الحادة. تُكتشف الأغراض حتى وهي مطفأة.
Restricted area — unregistered phones, laptops, watches and other wireless devices are not allowed beyond this point. ⇒ منطقة مقيدة — الهواتف والحواسيب والساعات وغيرها من الأجهزة اللاسلكية غير المسجّلة غير مسموح بها بعد هذه النقطة.
Security screening: identity, face, metal and device checks for everyone. ⇒ تفتيش أمني: التحقق من الهوية والوجه والمعادن والأجهزة للجميع.
Vehicle checkpoint — stop and wait for clearance. Barriers in use. ⇒ نقطة تفتيش المركبات — توقف وانتظر الإذن. الحواجز قيد الاستخدام.
Zone authorization ⇒ تفويض المنطقة
a public zone ⇒ منطقة عامة
a reception zone ⇒ منطقة استقبال
an operations zone ⇒ منطقة عمليات
a security zone ⇒ منطقة أمنية
a high security zone ⇒ منطقة أمنية عالية
public zones ⇒ المناطق العامة
reception zones ⇒ مناطق الاستقبال
operations zones ⇒ مناطق العمليات
security zones ⇒ المناطق الأمنية
high security zones ⇒ المناطق الأمنية العالية
no authorization ⇒ لا يوجد تفويض
review-overdue ⇒ متأخر عن المراجعة
{0} · {1} · screened to {2}. ⇒ {0} · {1} · مستوى الفحص {2}.
{0} · {1} · screened to {2} · escort required beyond reception. ⇒ {0} · {1} · مستوى الفحص {2} · يلزم مرافق بعد الاستقبال.
{0} has no zone type under {1} — entry refused (fail-secure). ⇒ {0} بلا نوع منطقة في {1} — يُرفض الدخول (إغلاق آمن).
{0} is {1}: no authorization needed. ⇒ {0} {1}: لا تحتاج تفويضاً.
{0}: the policy sets no screening minimum for {1} — entry refused (fail-secure). ⇒ {0}: السياسة لا تحدد حد الفحص لـ{1} — يُرفض الدخول (إغلاق آمن).
{0} is screened to {1}; {2} needs {3}. ⇒ مستوى فحص {0} هو {1}، و{2} تتطلب {3}.
Visitors are not allowed in {0} ({1}). ⇒ الزوار غير مسموح لهم في {0} ({1}).
Visitor {0} has no valid authorization for {1} ({2}). ⇒ الزائر {0} بلا تفويض ساري لـ{1} ({2}).
Visitor {0}: an escort is required in {1} — officer confirms the escort before entry. ⇒ الزائر {0}: يلزم مرافق في {1} — يؤكد الضابط المرافق قبل الدخول.
Visitor {0} escorted by {1}. ⇒ الزائر {0} مع المرافق {1}.
{0} has no need-to-access authorization for {1} — clearance {2} alone does not grant entry. ⇒ {0} بلا تفويض لحاجة الوصول إلى {1} — التصريح {2} وحده لا يمنح الدخول.
{0}'s authorization for {1} expired — clearance {2} alone does not grant entry. ⇒ انتهى تفويض {0} لـ{1} — التصريح {2} وحده لا يمنح الدخول.
{0}'s authorization for {1} was revoked — clearance {2} alone does not grant entry. ⇒ سُحب تفويض {0} لـ{1} — التصريح {2} وحده لا يمنح الدخول.
{0}'s authorization for {1} is overdue for review — clearance {2} alone does not grant entry. ⇒ تفويض {0} لـ{1} متأخر عن المراجعة — التصريح {2} وحده لا يمنح الدخول.
{0} is not authorized for {1} — clearance {2} alone does not grant entry. ⇒ {0} غير مفوض لـ{1} — التصريح {2} وحده لا يمنح الدخول.
{0} is authorized for {1} (personal: {2}; granted by {3}). ⇒ {0} مفوض لـ{1} (تفويض شخصي: {2}؛ منحه {3}).
{0} is authorized for {1} (group {2}: {3}; granted by {4}). ⇒ {0} مفوض لـ{1} (عبر المجموعة {2}: {3}؛ منحه {4}).
Destination {0} is {1} under {2} ⇒ الوجهة {0} {1} وفق {2}
Destination {0} is without a zone type under {1} ⇒ الوجهة {0} بلا نوع منطقة وفق {1}
Destination {0} requires Level {1} under {2} ⇒ الوجهة {0} تتطلب المستوى {1} وفق {2}
Destination {0} has no level under {1} — handled as Level 5 (fail-secure) ⇒ الوجهة {0} بلا مستوى وفق {1} — تُعامل كالمستوى 5 (إغلاق آمن)
SIMULATED airspace reading (training): no wireless device in the gate zone. ⇒ قراءة مجال جوي محاكاة (تدريب): لا يوجد جهاز لاسلكي في نطاق البوابة.
SIMULATED airspace reading (training): an unregistered wireless device in the gate zone. ⇒ قراءة مجال جوي محاكاة (تدريب): جهاز لاسلكي غير مسجّل في نطاق البوابة.
Airspace sensor is not reporting — devices cannot be checked automatically; ask for every device and check it by hand. ⇒ مستشعر المجال الجوي لا يرسل بيانات — لا يمكن فحص الأجهزة آلياً؛ اسأل عن كل جهاز وافحصه يدوياً.
{0} device(s) in the gate zone, all authorized for {1}. ⇒ {0} جهاز في نطاق البوابة، وكلها مصرّح بها لـ{1}.
{0}: {1} is restricted {2} and is not registered to {3} ⇒ {0}: {1} مقيّد {2} وغير مسجّل باسم {3}
in {0} ⇒ في {0}
Card factor accepted for {0} under the zone model ⇒ قُبل عامل البطاقة لـ{0} وفق نموذج المناطق
Card factor refused for {0} under the zone model ⇒ رُفض عامل البطاقة لـ{0} وفق نموذج المناطق
Card factor needs an officer for {0} ⇒ عامل البطاقة لـ{0} يحتاج تحقق الضابط
Entry refused at {0} — {1} has no valid authorization for {2} ⇒ رُفض الدخول عند {0} — {1} بلا تفويض ساري لـ{2}
Zone authorization refused at {0} ⇒ رُفض تفويض المنطقة عند {0}
{0} Under {1} a restricted zone needs a valid need-to-access authorization; clearance alone is not enough. If the need is real, personnel security grants it — never wave the person through. ⇒ {0} وفق {1} تحتاج المنطقة المقيدة تفويضاً سارياً لحاجة الوصول، والتصريح وحده لا يكفي. إن كانت الحاجة حقيقية يمنحه أمن الأفراد — لا تُدخل الشخص دونه.
{0} · {1} ({2}). Card factor only: face, PIN, fingerprint and door feedback are still required. No entry is confirmed. ⇒ {0} · {1} ({2}). عامل البطاقة فقط: ما زال الوجه والرمز السري والبصمة وتغذية الباب مطلوبة. لم يُؤكَّد أي دخول.
Gate A training: {0} ⇒ تدريب البوابة A: {0}
Grant, review and revoke need-to-access authorizations for restricted zones ⇒ منح تفويضات حاجة الوصول للمناطق المقيدة ومراجعتها وسحبها
Open, annotate and close insider-threat investigation cases (each read is audited) ⇒ فتح قضايا التحقيق في التهديد الداخلي وإضافة الملاحظات وإغلاقها (كل قراءة مسجّلة)
Watches open incidents and confirms, dismisses or escalates them; records maintenance. ⇒ يتابع الحوادث المفتوحة ويؤكدها أو يغلقها أو يصعّدها، ويسجّل الصيانة.
Read-only: incidents and the audit log. SAWN receives no system or account events yet, so there is nothing cyber-specific to handle. ⇒ قراءة فقط: الحوادث وسجل التدقيق. لا يستقبل صون أحداث الأنظمة أو الحسابات بعد، فلا يوجد عمل سيبراني خاص.
Runs Gate A and Gate B and decides wireless device authorization. ⇒ يشغّل البوابتين A وB ويقرر اعتماد الأجهزة اللاسلكية.
Watches aircraft and wireless devices; requests device authorization from the gate officer and cannot allow or deny. ⇒ يراقب الطائرات والأجهزة اللاسلكية، ويطلب اعتماد الجهاز من ضابط البوابة، ولا يسمح ولا يرفض بنفسه.
Sees the whole picture, approves the facility assessment as the active policy, decides escalations. ⇒ يرى الصورة كاملة، ويعتمد تقييم المنشأة سياسةً نشطة، ويقرر الحالات المصعّدة.
Prepares the physical assessment, owns remediation, follows confirmed physical incidents and dispatches field teams. ⇒ يعدّ التقييم المادي، ويملك المعالجة، ويتابع الحوادث المادية المؤكدة ويوجّه الفرق الميدانية.
Records assets, their data classification and critical-system status in the assessment draft; reads the audit log and reports. No cyber-event monitoring exists yet. ⇒ يسجّل الأصول وتصنيف بياناتها وحالة الأنظمة الحساسة في مسودة التقييم، ويقرأ سجل التدقيق والتقارير. لا توجد مراقبة للأحداث السيبرانية بعد.
Issues and revokes cards, manages people, grants need-to-access zone authorizations, records periodic and unused-access reviews. ⇒ يصدر البطاقات ويلغيها، ويدير الأشخاص، ويمنح تفويضات حاجة الوصول للمناطق، ويسجّل المراجعات الدورية ومراجعات الوصول غير المستخدم.
Reads insider-risk scores and the gate events behind them; opens, annotates and closes investigation cases. Access changes go through personnel security. ⇒ يقرأ درجات الخطر الداخلي وأحداث البوابة المسببة لها، ويفتح قضايا التحقيق ويضيف إليها ويغلقها. تغيير الصلاحيات يتم عبر أمن الأفراد.
Reads the audit log and reports; no incident or personal-record access. No server-side masking exists yet. ⇒ يقرأ سجل التدقيق والتقارير، دون الوصول إلى الحوادث أو السجلات الشخصية. لا يوجد إخفاء للبيانات في الخادم بعد.
Reads dashboards, the assessment and reports. No risk register exists yet. ⇒ يقرأ اللوحات والتقييم والتقارير. لا يوجد سجل مخاطر بعد.
Manages accounts, sensors, cameras, integrations and the system itself. Makes no security decisions. ⇒ يدير الحسابات والحساسات والكاميرات والتكاملات والنظام نفسه، ولا يتخذ قرارات أمنية.
Each identified NFC tap runs the Gate A decision with real inputs only. A required input that is not available (metal detector, ETD, face or airspace when required) gives a manual check, never an automatic allow. Door feedback is not connected, so an allow is a decision and never a confirmed entry. ⇒ كل تمرير بطاقة معروفة يشغّل قرار البوابة A بالمدخلات الحقيقية فقط. المدخل المطلوب غير المتاح (كاشف المعادن أو المتفجرات أو الوجه أو المجال الجوي عند طلبها) يعطي تحققاً يدوياً، ولا يعطي سماحاً آلياً أبداً. تغذية الباب غير مربوطة، فالسماح قرار وليس دخولاً مؤكداً.
Linked: each identified card tap is checked against the face camera (identity only; SAWN decides access). Recognition accuracy and liveness have not been tested on site. ⇒ مربوط: كل تمرير بطاقة معروفة يُقارن بكاميرا الوجه (للهوية فقط، وقرار الدخول لصون). دقة التعرف وكشف الحيوية لم تُختبر في الموقع.
The face service is not running (npm run face): taps get a manual face check. ⇒ خدمة الوجه لا تعمل (npm run face): يُتحقق من الوجه يدوياً عند كل تمرير.
Required by the gate policy and not integrated: every live decision is a manual check. ⇒ مطلوب في سياسة البوابة وغير مربوط: كل قرار حي يكون تحققاً يدوياً.
Not integrated; not required by the gate policy. ⇒ غير مربوط، وغير مطلوب في سياسة البوابة.
SAWN Face Recognition (not running) ⇒ خدمة التعرف على الوجه في صون (لا تعمل)
SAWN Face Recognition ⇒ خدمة التعرف على الوجه في صون
SAWN Face Recognition · camera {0} ⇒ خدمة التعرف على الوجه في صون · الكاميرا {0}
No face result for this tap (face service not linked or no face camera result) — the officer compares the person with the ID photo; no automatic allow. ⇒ لا توجد نتيجة وجه لهذا التمرير (خدمة الوجه غير مربوطة أو لا نتيجة من الكاميرا) — يقارن الضابط الشخص بصورة الهوية، ولا سماح آلي.
Not required by the gate policy. ⇒ غير مطلوب في سياسة البوابة.
Metal detector is not integrated — manual search before entry; no automatic allow. ⇒ كاشف المعادن غير مربوط — تفتيش يدوي قبل الدخول، ولا سماح آلي.
Not integrated and not required by the gate policy. ⇒ غير مربوط وغير مطلوب في سياسة البوابة.
Explosive trace detector is not integrated — manual check; no automatic allow. ⇒ كاشف آثار المتفجرات غير مربوط — فحص يدوي، ولا سماح آلي.
Airspace sensor not reporting; not required by the gate policy. ⇒ مستشعر المجال الجوي لا يرسل، وغير مطلوب في سياسة البوابة.
The face is not linked to a person in SAWN. ⇒ الوجه غير مربوط بشخص في صون.
{0}'s access is not active in SAWN. ⇒ وصول {0} غير ساري في صون.
{0} has no valid SAWN card. ⇒ {0} ليس لديه بطاقة صون سارية.
This camera is not mapped to a facility zone, so SAWN cannot decide access here. ⇒ هذه الكاميرا غير مربوطة بمنطقة في المنشأة، فلا يستطيع صون تقرير الدخول هنا.
{0} is cleared to Level {1}; {2} requires Level {3}. ⇒ {0} مصرّح حتى المستوى {1}، و{2} تتطلب المستوى {3}.
Choose the person the permit is for ⇒ اختر الشخص الذي يُمنح له الاستثناء
{0}: {1}. A camera exception only quiets alerts about this verified person when already authorized; it never grants entry. ⇒ {0}: {1}. استثناء الكاميرا يحجب التنبيه عن هذا الشخص وحده بعد التحقق من هويته وما دام لديه تفويض سارٍ، ولا يمنح الدخول أبداً.
Personal alert exceptions are not available on “{0}”: {1}. Use an identity camera (camera 5). ⇒ الاستثناءات الشخصية غير متاحة على «{0}»: {1}. استخدم كاميرا الهوية (الكاميرا 5).
this camera cannot verify who a person is, so a personal exception would silence alerts about everyone in view ⇒ هذه الكاميرا لا تستطيع التحقق من هوية الشخص، فالاستثناء الشخصي سيُسكت التنبيه عن كل من يظهر فيها
Alert exception granted: {0} (not an entry permission). ⇒ مُنح استثناء التنبيه: {0} (ليس إذن دخول).
Camera alert held back by a personal exception ⇒ حُجب تنبيه كاميرا باستثناء شخصي
Camera alert exception revoked ⇒ أُلغي استثناء تنبيه الكاميرا
Alert exception revoked. ⇒ أُلغي استثناء التنبيه.
This camera cannot identify people, so no personal alert exception applies. ⇒ هذه الكاميرا لا تميّز هوية الأشخاص، فلا يُطبَّق عليها أي استثناء تنبيه شخصي.
no valid authorization for {0} ({1}) ⇒ لا يوجد تفويض ساري لـ{0} ({1})
person not active ⇒ الشخص غير نشط
Gate A live decision: {0} ⇒ قرار حي للبوابة A: {0}
Verification factors ⇒ عوامل التحقق
{0} of {1} required factors verified ({2}). ⇒ تحقق {0} من {1} من العوامل المطلوبة ({2}).
The active policy requires {0} factors here; {1} verified ({2}). PIN and fingerprint are not integrated and do not count — the officer verifies the missing factor; no automatic allow. ⇒ السياسة النشطة تتطلب هنا {0} عوامل، والمتحقق منها {1} ({2}). الرقم السري والبصمة غير مربوطين فلا يُحتسبان — يتحقق الضابط من العامل الناقص، ولا سماح آلي.
Lower the Gate A requirements ⇒ خفض متطلبات البوابة A
Lower the Gate A requirements: {0} ⇒ خفض متطلبات البوابة A: {0}
Gate A policy lowered: {0} ⇒ خُفّضت متطلبات البوابة A: {0}
The gate policy changed after this request; ask again. ⇒ تغيّرت سياسة البوابة بعد هذا الطلب؛ قدّم طلباً جديداً.
Camera 5 watches {0} (the approved camera zone). Changing it is an integration setting: Camera zones, integrations.edit. ⇒ الكاميرا 5 تراقب {0} (منطقة الكاميرا المعتمدة). تغييرها من إعدادات التكامل: مناطق الكاميرات، بصلاحية مدير التكامل.
Details are kept in the case (investigations.manage only). ⇒ التفاصيل محفوظة في القضية (لمن يملك صلاحية إدارة التحقيقات فقط).
Facility plan uploaded ⇒ رُفع مخطط المنشأة
Facility plan analysed ⇒ حُلّل مخطط المنشأة
Facility plan analysis failed ⇒ فشل تحليل مخطط المنشأة
Facility plan applied to the draft ⇒ طُبّقت نتائج مخطط المنشأة على المسودة
Facility plan apply refused ⇒ رُفض تطبيق مخطط المنشأة
Facility plan matched again ⇒ أُعيدت مطابقة مخطط المنشأة
Facility plan opened ⇒ فُتح ملف مخطط المنشأة
Plan not found ⇒ المخطط غير موجود
File not found ⇒ الملف غير موجود
Plan uploads need a database on disk ⇒ رفع المخططات يحتاج قاعدة بيانات على القرص
There is no draft. Start a zone-model draft first; a plan fills a draft only. ⇒ لا توجد مسودة. ابدأ مسودة بنموذج المناطق أولاً؛ المخطط يعبّئ المسودة فقط.
The current draft uses the legacy levels. Plan import fills a zone-model draft. ⇒ المسودة الحالية بالمستويات القديمة. رفع المخطط يعبّئ مسودة بنموذج المناطق.
Upload a PDF, PNG or JPG file (the file content is checked, not only its name). ⇒ ارفع ملف PDF أو PNG أو JPG (يُفحص محتوى الملف لا اسمه فقط).
File too large (max {0} MB) ⇒ الملف أكبر من المسموح ({0} ميغابايت كحد أقصى)
The file is empty ⇒ الملف فارغ
Give a reason for applying the plan (at least 5 characters) ⇒ اكتب سبب تطبيق المخطط (5 أحرف على الأقل)
The plan is still being analysed. ⇒ المخطط ما زال قيد التحليل.
The analysis failed, so there is nothing to apply: {0} ⇒ فشل التحليل، فلا يوجد ما يُطبَّق: {0}
Fix these before applying: {0} ⇒ صحّح هذه قبل التطبيق: {0}
The draft changed after this plan was matched (matched against revision {0}, now {1} revision {2}). Nothing was written. Match again, review, then apply. ⇒ تغيّرت المسودة بعد مطابقة هذا المخطط (طوبق على المراجعة {0}، والمسودة الآن {1} المراجعة {2}). لم يُكتب شيء. أعد المطابقة وراجع النتائج ثم طبّق.
The draft changed (now revision {0}) after the plan was matched against revision {1}. Match the plan again and review it before applying. ⇒ تغيّرت المسودة (الآن المراجعة {0}) بعد مطابقة المخطط على المراجعة {1}. أعد المطابقة وراجع قبل التطبيق.
The PDF is password-protected. ⇒ ملف PDF محمي بكلمة مرور.
The PDF could not be read ({0}). ⇒ تعذّرت قراءة ملف PDF ({0}).
The image could not be decoded (damaged or not a PNG/JPG). ⇒ تعذّرت قراءة الصورة (تالفة أو ليست PNG/JPG).
Unsupported file type: upload a PDF, PNG or JPG. ⇒ نوع ملف غير مدعوم: ارفع PDF أو PNG أو JPG.
No readable text was found, even with OCR. The image may be too small, blurred or rotated. ⇒ لم يُعثر على نص مقروء حتى بقراءة OCR. قد تكون الصورة صغيرة أو ضبابية أو مائلة.
The file has no readable text. ⇒ لا يحتوي الملف على نص مقروء.
Analysis took longer than {0} s and was stopped. ⇒ استغرق التحليل أكثر من {0} ثانية فأُوقف.
Analysis failed: {0} ⇒ فشل التحليل: {0}
Analysis was interrupted (server restarted). Upload the file again. ⇒ توقف التحليل (أُعيد تشغيل الخادم). ارفع الملف مرة أخرى.
OCR language data is not installed (cache/ocr). Run "npm run models:ocr" once with internet access; no plan data is sent when it runs. ⇒ بيانات لغات OCR غير مثبّتة (cache/ocr). شغّل «npm run models:ocr» مرة واحدة مع اتصال بالإنترنت؛ لا تُرسل أي بيانات من المخطط.
{0}: choose a facility zone or exclude it ⇒ {0}: اختر منطقة من نموذج المنشأة أو استبعدها
{0}: choose a facility gate or exclude it ⇒ {0}: اختر بوابة من نموذج المنشأة أو استبعدها
A name is required ⇒ الاسم مطلوب
{0}: an asset needs a zone ⇒ {0}: الأصل يحتاج منطقة
{0}: choose an existing asset ⇒ {0}: اختر أصلاً موجوداً
{0}: choose an existing component ⇒ {0}: اختر مكوّناً موجوداً
page title “{0}” ⇒ عنوان الصفحة «{0}»
same line “{0}” ⇒ في السطر نفسه «{0}»
gate {0} ⇒ البوابة {0}
nearest label on the plan ⇒ أقرب تسمية في المخطط (بانتظار المراجعة)
set by the reviewer ⇒ حدّده المراجع
gate GA (corrected: the kiosk is at Gate A, not in Z1) ⇒ البوابة GA (صُحّح: الكشك عند البوابة A وليس داخل Z1)
Facility plan marked as the retained source ⇒ عُيّن مخطط المنشأة مصدراً معتمداً
Facility plan marked as a temporary QA upload ⇒ عُيّن مخطط المنشأة رفع اختبار مؤقت
Map draft started ⇒ بدأت مسودة خريطة العمليات
Map boundaries saved ⇒ حُفظت حدود الخريطة
Map alignment reviewed ⇒ رُوجعت محاذاة الخريطة
Map layout applied ⇒ طُبّق مخطط المنشأة على خريطة العمليات
Map layout removed ⇒ أُوقف مخطط المنشأة على خريطة العمليات
Map draft discarded ⇒ أُلغيت مسودة الخريطة
There is no map draft. Choose a plan page first. ⇒ لا توجد مسودة خريطة. اختر صفحة من المخطط أولاً.
There is no map draft. ⇒ لا توجد مسودة خريطة.
The map draft changed (now revision {0}). Reload it and repeat the change. ⇒ تغيّرت مسودة الخريطة (الآن المراجعة {0}). أعد تحميلها وكرر التعديل.
The map draft changed (now revision {0}). Review it again before applying. ⇒ تغيّرت مسودة الخريطة (الآن المراجعة {0}). راجعها مجدداً قبل التطبيق.
Review the alignment first: boundaries and the background are placed on the map through it. ⇒ راجع المحاذاة أولاً: بها توضع الحدود والخلفية على الخريطة.
Link at least one boundary to a zone first. ⇒ اربط حداً واحداً على الأقل بمنطقة أولاً.
Confirm that you reviewed the overlay before the alignment is recorded ⇒ أكّد أنك راجعت التطابق قبل تسجيل المحاذاة
Describe what you checked (at least 5 characters) ⇒ اكتب ما الذي تحققت منه (5 أحرف على الأقل)
The horizontal and vertical scales differ by {0} %: the corners do not match the building. Pick them again. ⇒ يختلف المقياس الأفقي عن الرأسي بنسبة {0}٪: الزاويتان لا تطابقان المبنى. حدّدهما مجدداً.
Click the top-left corner first, then the bottom-right corner of the building ⇒ انقر الزاوية العليا اليسرى أولاً ثم السفلى اليمنى للمبنى
Unknown zone {0}: the map links to existing zone IDs only ⇒ منطقة غير معروفة {0}: الخريطة تربط بمعرّفات المناطق الموجودة فقط
{0}: the boundary crosses itself ⇒ {0}: الحد يتقاطع مع نفسه
{0}: a boundary needs 3–200 points ⇒ {0}: الحد يحتاج من 3 إلى 200 نقطة
{0}: points must be on the page ⇒ {0}: يجب أن تكون النقاط داخل الصفحة
{0}: the boundary has no area ⇒ {0}: الحد بلا مساحة
Only a plan whose analysis finished can be used for the map. ⇒ يُستخدم للخريطة مخطط اكتمل تحليله فقط.
No map layout is applied. ⇒ لا يوجد مخطط مطبّق على الخريطة.
A map draft exists (MAP-{0}, revision {1}). Reload it before replacing its page. ⇒ توجد مسودة خريطة (MAP-{0}، المراجعة {1}). أعد تحميلها قبل استبدال صفحتها.
Purpose must be source or qa ⇒ الغرض: مصدر أو اختبار
Give a note (at least 5 characters) ⇒ اكتب ملاحظة (5 أحرف على الأقل)
`;
