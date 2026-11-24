// Arabic dictionary — AI cameras on real video (sources, analysis, evidence frames).
// Format: "English ⇒ Arabic"; {0}, {1}… are variable parts (see ../i18n.js).
export default `
AI cameras · real video ⇒ كاميرات الذكاء الاصطناعي · فيديو حقيقي
This computer’s camera, IP cameras (MJPEG / JPEG snapshot over HTTP) or a video file to test with. People and weapons: COCO-SSD model (TensorFlow.js, runs on this computer). Fire, smoke and gas: colour and motion analysis — no trained model yet, expect false alarms. Confirmed detections become incidents with the frame as evidence. Analysis runs while this console is open. ⇒ كاميرا هذا الجهاز، أو كاميرات IP (بث MJPEG أو لقطة JPEG عبر HTTP)، أو ملف فيديو للتجربة. الأشخاص والأسلحة: نموذج COCO-SSD (TensorFlow.js، يعمل على هذا الجهاز). الحريق والدخان والغاز: تحليل للألوان والحركة — بدون نموذج مدرّب بعد، فتوقّع إنذارات خاطئة. الاكتشافات المؤكدة تصبح حوادث مع الإطار كدليل. يعمل التحليل طالما وحدة التحكم هذه مفتوحة.
Add camera ⇒ إضافة كاميرا
Add a camera ⇒ إضافة كاميرا
No cameras yet. Add one — a video file is the quickest way to try the analysis. ⇒ لا توجد كاميرات بعد. أضف واحدة — ملف الفيديو أسرع طريقة لتجربة التحليل.
IP cameras: use the camera’s MJPEG stream or JPEG snapshot address (RTSP is not supported in the browser). A video file is chosen on the camera tile and stays on this computer. ⇒ كاميرات IP: استخدم عنوان بث MJPEG أو لقطة JPEG للكاميرا (RTSP غير مدعوم في المتصفح). ملف الفيديو يُختار من بطاقة الكاميرا ويبقى على هذا الجهاز.
e.g. Warehouse aisle 4 ⇒ مثال: ممر المستودع 4
Video file (to test) ⇒ ملف فيديو (للتجربة)
This computer’s camera / USB camera ⇒ كاميرا هذا الجهاز / كاميرا USB
IP camera — MJPEG stream (http://…) ⇒ كاميرا IP — بث MJPEG ‏(http://…)
IP camera — JPEG snapshot (http://…) ⇒ كاميرا IP — لقطة JPEG ‏(http://…)
Camera address (IP cameras only) ⇒ عنوان الكاميرا (لكاميرات IP فقط)
Analyse: {0} ⇒ تحليل: {0}
Fire ⇒ حريق
Smoke ⇒ دخان
No analysis selected ⇒ لم يُحدَّد أي تحليل
Add camera ⇒ إضافة كاميرا
{0} added. ⇒ تمت إضافة {0}.
{0} saved. ⇒ تم حفظ {0}.
{0} removed. ⇒ تمت إزالة {0}.
Remove {0}? ⇒ إزالة {0}؟
Its incidents and evidence stay. ⇒ تبقى حوادثها وأدلتها.
Remove camera ⇒ إزالة الكاميرا
Choose video… ⇒ اختر فيديو…
Another video… ⇒ فيديو آخر…
Start ⇒ تشغيل
Stop ⇒ إيقاف
Stopped ⇒ متوقفة
Starting… ⇒ جارٍ التشغيل…
Loading AI model… ⇒ جارٍ تحميل نموذج الذكاء الاصطناعي…
Running · {0} analyses/s ⇒ تعمل · {0} تحليل/ث
Choose a video file to start ⇒ اختر ملف فيديو للبدء
Press Start ⇒ اضغط تشغيل
Choose a video file first. ⇒ اختر ملف فيديو أولًا.
Camera permission refused ⇒ رُفض إذن الكاميرا
No picture — check the address, user name and password ⇒ لا توجد صورة — تحقق من العنوان واسم المستخدم وكلمة المرور
Analysis error: {0} ⇒ خطأ في التحليل: {0}
Camera frames (evidence) ⇒ إطارات الكاميرا (أدلة)
Weapon detected (camera) ⇒ اكتُشف سلاح (كاميرا)
Person in restricted zone (camera) ⇒ شخص في منطقة محظورة (كاميرا)
TEST VIDEO · {0} ⇒ فيديو تجريبي · {0}
Uploaded test video ⇒ فيديو تجريبي مرفوع
Detector ⇒ أداة الكشف
Detected by: {0} ⇒ اكتشفه: {0}
Analysed on the console of {0} ⇒ حُلّل على وحدة تحكم {0}
{0} · confidence {1} ⇒ {0} · الثقة {1}
COCO-SSD object detection model (TensorFlow.js). ⇒ نموذج كشف الأجسام COCO-SSD ‏(TensorFlow.js).
COCO-SSD person detection with zone check. ⇒ كشف الأشخاص بـ COCO-SSD مع التحقق من المنطقة.
Flame colour and flicker analysis (no trained model). ⇒ تحليل لون اللهب ووميضه (بدون نموذج مدرّب).
Analysis of grey moving regions (no trained model). ⇒ تحليل المناطق الرمادية المتحركة (بدون نموذج مدرّب).
{0} “{1}”: the AI analysis saw {2} in several consecutive frames. {3} Check the picture before acting. ⇒ {0} «{1}»: رأى تحليل الذكاء الاصطناعي {2} في عدة إطارات متتالية. {3} تحقق من الصورة قبل التصرف.
Camera ⇒ الكاميرا
a person inside “{0}” ⇒ شخصًا داخل «{0}»
{0} · {1} detected ⇒ {0} · اكتُشف {1}
Camera sources changed ⇒ تغيّرت مصادر الكاميرات
Unidentified — no badge reader linked to this camera ⇒ غير معروف الهوية — لا يوجد قارئ شارات مرتبط بهذه الكاميرا
Camera address must start with http:// or https:// ⇒ يجب أن يبدأ عنوان الكاميرا بـ http:// أو https://
Camera not found ⇒ الكاميرا غير موجودة
Camera answered HTTP {0} ⇒ ردّت الكاميرا HTTP {0}
Camera answered HTTP {0} (check the user name and password) ⇒ ردّت الكاميرا HTTP {0} (تحقق من اسم المستخدم وكلمة المرور)
Cannot reach the camera: {0} ⇒ تعذّر الوصول إلى الكاميرا: {0}
Unknown detection ⇒ اكتشاف غير معروف
fire ⇒ حريق
person ⇒ شخص
knife ⇒ سكين
scissors ⇒ مقص
baseball bat ⇒ مضرب بيسبول
Open laptop camera ⇒ فتح كاميرا اللابتوب
Upload video ⇒ رفع فيديو
Add IP camera ⇒ إضافة كاميرا IP
No camera open. Open the laptop camera or upload a video to start — or add an IP camera. ⇒ لا توجد كاميرا مفتوحة. افتح كاميرا اللابتوب أو ارفع فيديو للبدء — أو أضف كاميرا IP.
This computer’s camera ⇒ كاميرا هذا الجهاز
Video ⇒ فيديو
DR-1 · Drone camera ⇒ DR-1 · كاميرا المسيّرة
Draw a zone on a camera picture (“Draw zone”): every person the AI sees entering it is logged here with the time in, time out and how long they stayed. ⇒ ارسم منطقة على صورة الكاميرا («رسم منطقة»): كل شخص يراه الذكاء الاصطناعي يدخلها يُسجَّل هنا مع وقت الدخول والخروج ومدة البقاء.
Open the laptop camera or upload a video to analyse it now; IP cameras (MJPEG / JPEG snapshot over HTTP) are added by a supervisor. People and weapons: COCO-SSD model (TensorFlow.js, runs on this computer). Fire, smoke and gas: colour and motion analysis — no trained model yet, expect false alarms. Confirmed detections become incidents with the frame as evidence. Analysis runs while this console is open. ⇒ افتح كاميرا اللابتوب أو ارفع فيديو لتحليله الآن؛ كاميرات IP (بث MJPEG أو لقطة JPEG عبر HTTP) يضيفها المشرف. الأشخاص والأسلحة: نموذج COCO-SSD ‏(TensorFlow.js، يعمل على هذا الجهاز). الحريق والدخان والغاز: تحليل للألوان والحركة — بدون نموذج مدرّب بعد، فتوقّع إنذارات خاطئة. الاكتشافات المؤكدة تصبح حوادث مع الإطار كدليل. يعمل التحليل طالما وحدة التحكم هذه مفتوحة.
People & weapons (AI model) ⇒ الأشخاص والأسلحة (نموذج ذكاء اصطناعي)
Behaviour (loitering, circling, running, person down) ⇒ السلوك (التسكّع، الدوران حول المبنى، الركض، سقوط شخص)
Zones (sensitive area, door, fence) ⇒ المناطق (منطقة حساسة، باب، سور)
General camera ⇒ كاميرا عامة
Sensitive area camera (permit needed) ⇒ كاميرا منطقة حساسة (تحتاج تصريح)
Tower 360° camera (perimeter) ⇒ كاميرا برج ‏360° (المحيط)
Sensitive area (permit needed) ⇒ منطقة حساسة (تحتاج تصريح)
Door ⇒ باب
Fence / wall (climbing) ⇒ سور / جدار (التسلق)
Watch zone (log entries only) ⇒ منطقة مراقبة (تسجيل الدخول فقط)
Camera role ⇒ دور الكاميرا
Sensitive area: nobody without a permit. Tower 360°: loitering, circling, weapons, fire and fence climbing around the site. ⇒ المنطقة الحساسة: لا يدخلها أحد بدون تصريح. برج ‏360°: التسكّع والدوران حول المبنى والأسلحة والحريق وتسلق السور حول الموقع.
Check sensor alerts (unauthorized device → look at who is there) ⇒ التحقق من تنبيهات الحساسات (جهاز غير مصرح به ← من الموجود هناك)
Sensors this camera covers (IDs, comma-separated; empty = all) ⇒ الحساسات التي تغطيها هذه الكاميرا (المعرّفات مفصولة بفواصل؛ فارغ = الكل)
e.g. AS-1, ESP32-GATE ⇒ مثال: AS-1, ESP32-GATE
Checks sensor device alerts ⇒ تتحقق من تنبيهات أجهزة الحساسات
Zone type ⇒ نوع المنطقة
e.g. Server room ⇒ مثال: غرفة الخوادم
Door: draw it around the door and its handle. Fence: draw it over the fence or wall, from its base to its top. ⇒ الباب: ارسمه حول الباب ومقبضه. السور: ارسمه فوق السور أو الجدار من أسفله إلى أعلاه.
Sensitive area: alert after (minutes inside) ⇒ المنطقة الحساسة: تنبيه بعد (دقائق داخلها)
Permit · {0} ⇒ تصريح · {0}
While the permit is active, people in this camera’s sensitive area are not reported. It ends by itself. ⇒ طالما التصريح ساري، لا يُبلَّغ عن الأشخاص في المنطقة الحساسة لهذه الكاميرا. ينتهي تلقائيًا.
Who is allowed in ⇒ من المسموح له بالدخول
e.g. Maintenance team — Ahmed ⇒ مثال: فريق الصيانة — أحمد
For how many minutes ⇒ لكم دقيقة
Reason (optional) ⇒ السبب (اختياري)
Grant permit ⇒ منح التصريح
Grant permit… ⇒ منح تصريح…
Permit granted: {0}. ⇒ تم منح التصريح: {0}.
Permit revoked. ⇒ تم إلغاء التصريح.
Permit: {0} until {1} (by {2}) ⇒ تصريح: {0} حتى {1} (من {2})
No permit — anyone inside the sensitive area is reported ⇒ لا يوجد تصريح — أي شخص داخل المنطقة الحساسة يُبلَّغ عنه
Area permit granted ⇒ مُنح تصريح دخول منطقة
Area permit revoked ⇒ أُلغي تصريح دخول منطقة
Permit not found ⇒ التصريح غير موجود
Who is the permit for? ⇒ لمن التصريح؟
Camera required ⇒ الكاميرا مطلوبة
Permit length must be 1–{0} minutes ⇒ مدة التصريح يجب أن تكون بين 1 و{0} دقيقة
Unauthorized person in a sensitive area (camera) ⇒ شخص غير مصرح له في منطقة حساسة (كاميرا)
Unauthorized person trying to open the door (camera) ⇒ شخص غير مصرح له يحاول فتح الباب (كاميرا)
Unauthorized person staying in a sensitive area (camera) ⇒ شخص غير مصرح له باقٍ في منطقة حساسة (كاميرا)
Person loitering around the site (camera) ⇒ شخص يتسكّع حول الموقع (كاميرا)
Person circling the building (camera) ⇒ شخص يدور حول المبنى (كاميرا)
Perimeter breach: fence climb (camera) ⇒ اختراق المحيط: تسلق السور (كاميرا)
Person running (camera) ⇒ شخص يركض (كاميرا)
Person down (camera) ⇒ شخص ساقط على الأرض (كاميرا)
person in “{0}” without a permit ⇒ شخص في «{0}» بدون تصريح
person in “{0}” for {1} min without a permit ⇒ شخص في «{0}» منذ {1} دقيقة بدون تصريح
person at the door “{0}” for {1} s without a permit ⇒ شخص عند الباب «{0}» منذ {1} ث بدون تصريح
person climbing “{0}” ⇒ شخص يتسلق «{0}»
person crossed “{0}” ⇒ شخص عبر «{0}»
person around the site for {0} min ⇒ شخص حول الموقع منذ {0} دقيقة
person circling the building ({0}) ⇒ شخص يدور حول المبنى ({0})
went right round the 360° view ⇒ دار حول كامل صورة ‏360°
crossed {0} % of the 360° view ⇒ قطع {0} ٪ من صورة ‏360°
walked back and forth {0} times ⇒ ذهب وعاد {0} مرات
person running ⇒ شخص يركض
person down (lying on the ground) ⇒ شخص ساقط (ممدّد على الأرض)
flames next to a person (possible arson) ⇒ لهب بجانب شخص (احتمال إشعال متعمّد)
{0} carried by a person ⇒ {0} يحمله شخص
COCO-SSD person detection, tracked frame by frame, inside the sensitive area with no active permit. ⇒ كشف الأشخاص بـ COCO-SSD مع التتبع إطارًا بإطار: داخل المنطقة الحساسة بدون تصريح ساري.
COCO-SSD person detection, tracked frame by frame, staying at the door with no active permit. ⇒ كشف الأشخاص بـ COCO-SSD مع التتبع إطارًا بإطار: باقٍ عند الباب بدون تصريح ساري.
COCO-SSD person detection, tracked frame by frame, inside the sensitive area longer than allowed. ⇒ كشف الأشخاص بـ COCO-SSD مع التتبع إطارًا بإطار: داخل المنطقة الحساسة أطول من المسموح.
COCO-SSD person detection, tracked frame by frame, someone in view for minutes. ⇒ كشف الأشخاص بـ COCO-SSD مع التتبع إطارًا بإطار: شخص ظاهر لعدة دقائق.
COCO-SSD person detection, tracked frame by frame, path back and forth along / around the building. ⇒ كشف الأشخاص بـ COCO-SSD مع التتبع إطارًا بإطار: مسار ذهاب وعودة بمحاذاة المبنى أو حوله.
COCO-SSD person detection, tracked frame by frame, feet raised on or crossing the fence line. ⇒ كشف الأشخاص بـ COCO-SSD مع التتبع إطارًا بإطار: القدمان مرتفعتان على السور أو تعبرانه.
COCO-SSD person detection, tracked frame by frame, moving faster than walking pace. ⇒ كشف الأشخاص بـ COCO-SSD مع التتبع إطارًا بإطار: حركة أسرع من المشي.
COCO-SSD person detection, tracked frame by frame, body lying on the ground for seconds. ⇒ كشف الأشخاص بـ COCO-SSD مع التتبع إطارًا بإطار: الجسم ممدّد على الأرض لعدة ثوانٍ.
{0} “{1}”: the AI analysis saw {2}. {3} Check the picture before acting. ⇒ {0} «{1}»: رأى تحليل الذكاء الاصطناعي {2}. {3} تحقق من الصورة قبل التصرف.
No permit was active for this camera. ⇒ لم يكن هناك تصريح ساري لهذه الكاميرا.
{0} · camera check: {1} ⇒ {0} · تحقق الكاميرا: {1}
{0} person(s) visible, one carrying a {1} ⇒ {0} شخص ظاهر، أحدهم يحمل {1}
{0} person(s) visible where the device was heard ⇒ {0} شخص ظاهر حيث رُصد الجهاز
nobody visible — the device may be hidden, left behind or outside the picture ⇒ لا أحد ظاهر — قد يكون الجهاز مخفيًا أو متروكًا أو خارج الصورة
camera check · {0} person(s) ⇒ تحقق الكاميرا · {0} شخص
Camera check of sensor alert ⇒ تحقق الكاميرا من تنبيه الحساس
Incident escalated ⇒ تم تصعيد الحادثة
{0} · weapon seen next to the device ⇒ {0} · شوهد سلاح بجانب الجهاز
Open the laptop camera or upload a video to analyse it now; IP cameras (MJPEG / JPEG snapshot over HTTP) are added by a supervisor. People and weapons: COCO-SSD model (TensorFlow.js, runs on this computer); the people it finds are tracked to judge behaviour. Camera roles: a sensitive-area camera reports anyone inside without a permit, at the door or staying too long; a tower 360° camera reports loitering, circling, weapons, fire and fence climbing. Cameras that check sensor alerts look at who is there when a sensor reports an unauthorized device. Fire and smoke: colour and motion analysis — no trained model yet, expect false alarms. Confirmed detections become incidents with the frame as evidence and go to the responsible team. Analysis runs while this console is open. ⇒ افتح كاميرا اللابتوب أو ارفع فيديو لتحليله الآن؛ كاميرات IP (بث MJPEG أو لقطة JPEG عبر HTTP) يضيفها المشرف. الأشخاص والأسلحة: نموذج COCO-SSD ‏(TensorFlow.js، يعمل على هذا الجهاز)، ويُتتبَّع الأشخاص الذين يكتشفهم للحكم على سلوكهم. أدوار الكاميرات: كاميرا المنطقة الحساسة تبلّغ عن أي شخص داخلها بدون تصريح أو عند الباب أو باقٍ مدة طويلة؛ وكاميرا البرج ‏360° تبلّغ عن التسكّع والدوران حول المبنى والأسلحة والحريق وتسلق السور. الكاميرات التي تتحقق من تنبيهات الحساسات تنظر إلى من هو موجود عندما يرصد حساس جهازًا غير مصرح به. الحريق والدخان: تحليل للألوان والحركة — بدون نموذج مدرّب بعد، فتوقّع إنذارات خاطئة. الاكتشافات المؤكدة تصبح حوادث مع الإطار كدليل وتُرسل للفريق المختص. يعمل التحليل طالما وحدة التحكم هذه مفتوحة.
Firearm detected (camera) ⇒ اكتُشف سلاح ناري (كاميرا)
firearm ⇒ سلاح ناري
{0} · armed ⇒ {0} · مسلّح
OWLv2 open-vocabulary detector (GPU), seen clearly once or in two looks in a row, and confirmed on a close-up crop. ⇒ كاشف OWLv2 بالوصف (على كرت الشاشة): ظهر بوضوح مرة أو في نظرتين متتاليتين، وتأكّد على صورة مقرّبة.
Object detector (RT-DETRv2, or COCO-SSD without it); no person holding it. ⇒ كاشف الأجسام (RT-DETRv2، أو COCO-SSD عند تعذّره)؛ لا يحمله أحد.
Object detector (RT-DETRv2, or COCO-SSD without it); the weapon is at a person’s hands. ⇒ كاشف الأجسام (RT-DETRv2، أو COCO-SSD عند تعذّره)؛ السلاح عند يد شخص.
Armed person: weapon in hand (camera) ⇒ شخص مسلّح: سلاح في يده (كاميرا)
Bladed weapon detected (camera) ⇒ اكتُشف سلاح أبيض (كاميرا)
Possible arson: flames next to a person (camera) ⇒ احتمال إشعال متعمّد: لهب بجانب شخص (كاميرا)
Person near the building (camera) ⇒ شخص قرب المبنى (كاميرا)
person near the building ⇒ شخص قرب المبنى
{0} people near the building ⇒ {0} أشخاص قرب المبنى
{0} in a person’s hand ⇒ {0} في يد شخص
cell phone ⇒ جوال
laptop ⇒ لابتوب
COCO-SSD object detection model (TensorFlow.js); no person holding it. ⇒ نموذج كشف الأجسام COCO-SSD ‏(TensorFlow.js)؛ لا يحمله أحد.
COCO-SSD object detection model (TensorFlow.js); the weapon is at a person’s hands. ⇒ نموذج كشف الأجسام COCO-SSD ‏(TensorFlow.js)؛ السلاح عند يد شخص.
Flame colour and flicker analysis (no trained model) with a person detected next to the flames. ⇒ تحليل لون اللهب ووميضه (بدون نموذج مدرّب) مع رصد شخص بجانب اللهب.
COCO-SSD person detection, tracked frame by frame, someone in the tower’s view for a few seconds. ⇒ كشف الأشخاص بـ COCO-SSD مع التتبع إطارًا بإطار: شخص ظاهر في صورة البرج لعدة ثوانٍ.
{0} person(s) visible, one holding a {1} — likely the device holder ⇒ {0} شخص ظاهر، أحدهم يحمل {1} — غالبًا هو حامل الجهاز
{0} · person holding a {1} where the device was heard ⇒ {0} · شخص يحمل {1} حيث رُصد الجهاز
People search · ask the cameras ⇒ البحث عن الأشخاص · اسأل الكاميرات
Describe the person — e.g. man in a white thobe, last hour ⇒ صِف الشخص — مثال: رجل بثوب أبيض، آخر ساعة
Describe the person ⇒ صِف الشخص
The AI cameras keep a picture of each person they track (kept 7 days). Describe someone in Arabic or English and the closest matches come back with camera and time. Every search is recorded in the audit log. ⇒ كاميرات الذكاء الاصطناعي تحفظ صورة لكل شخص تتتبعه (تُحفظ 7 أيام). صِف أي شخص بالعربي أو الإنجليزي وتظهر لك أقرب النتائج مع الكاميرا والوقت. كل بحث يُسجَّل في سجل التدقيق.
Tell me first what the person looks like — then I can narrow it down by time or camera. ⇒ قل لي أول وش شكل الشخص — بعدها أقدر أضيّق البحث بالوقت أو الكاميرا.
I did not understand a description in that. ⇒ ما فهمت وصف في كلامك.
Describe what the person wears: colours and clothes (shirt, thobe, abaya, jacket…), what they carry, man / woman / child. ⇒ صِف وش يلبس الشخص: الألوان والملابس (قميص، ثوب، عباية، جاكيت…)، وش يحمل، رجل / امرأة / طفل.
Then refine: “last hour”, “today”, “after 3 pm”, a camera name, or “more”. “New search” starts again. ⇒ بعدها ضيّق البحث: «آخر ساعة»، «اليوم»، «بعد الساعة 3 العصر»، اسم كاميرا، أو «المزيد». «بحث جديد» يبدأ من جديد.
Searched for ⇒ بحثت عن
last 7 days ⇒ آخر 7 أيام
all cameras ⇒ كل الكاميرات
since {0} ⇒ منذ {0}
until {0} ⇒ حتى {0}
camera {0} ⇒ الكاميرا {0}
Words I did not understand: {0} ⇒ كلمات ما فهمتها: {0}
Nobody in these pictures looks like that. ⇒ ما في أحد في الصور يشبه هذا الوصف.
No pictures of people yet for these filters — start an AI camera with people in view. ⇒ ما في صور أشخاص بهذي الشروط للحين — شغّل كاميرا ذكاء اصطناعي فيها ناس.
More results (page {0}) of {1} people. ⇒ نتائج إضافية (صفحة {0}) من {1} شخص.
{0} people seen — closest to the description first. ⇒ {0} شخص — الأقرب للوصف أولًا.
{0} new pictures are still being processed. ⇒ {0} صورة جديدة قيد المعالجة.
Ranked by how well clothes and colours match; this is not identification. Small items (bags) and age are less reliable — check the pictures. ⇒ الترتيب حسب تطابق الملابس والألوان، وهذا ليس تعرّفًا على الهوية. الأغراض الصغيرة (الشنط) والعمر أقل دقة — تحقق من الصور.
Searching… ⇒ أبحث…
New search. Describe the person. ⇒ بحث جديد. صِف الشخص.
More ⇒ المزيد
People search ⇒ البحث عن الأشخاص
The cameras’ pictures of people are still being processed — ask again in a moment. ⇒ صور الأشخاص من الكاميرات لسه قيد المعالجة — اسأل مرة ثانية بعد لحظات.
Person smoking (camera) ⇒ شخص يدخّن (كاميرا)
person smoking ⇒ شخص يدخّن
smoking ⇒ تدخين
OWLv2 on a close-up of the head and hands (the person with a hand at the face first); the cigarette must beat a phone, cup or food there, clearly once or in two looks. ⇒ OWLv2 على صورة مقرّبة للرأس واليدين (الأولوية لمن يده عند وجهه)؛ لازم تتفوّق السيجارة على الجوال أو الكوب أو الأكل، بوضوح مرة أو في نظرتين.
Smart detection ⇒ الكشف الذكي
Operations ⇒ العمليات
Live cameras ⇒ الكاميرات المباشرة
Current detections ⇒ الكشوفات الحالية
Thermal view: on ⇒ العرض الحراري: يعمل
Thermal view: off ⇒ العرض الحراري: متوقف
Thermal view is a colour rendering of the ordinary camera picture with the detected people shown warm — it does not measure temperature. ⇒ العرض الحراري تلوين لصورة الكاميرا العادية يظهر فيه الأشخاص المكتشفون كأجسام دافئة — لا يقيس الحرارة.
{0} cameras · {1} people in view ⇒ {0} كاميرا · {1} شخص ظاهر
{0} cameras ⇒ {0} كاميرا
{0} open ⇒ {0} مفتوحة
{0} people ⇒ {0} أشخاص
{0} person ⇒ {0} شخص
No camera is running. Open the laptop camera or upload a video — or start a camera on the Drone & cameras page. ⇒ لا توجد كاميرا تعمل. افتح كاميرا الجهاز أو ارفع فيديو — أو شغّل كاميرا من صفحة الطائرة والكاميرات.
No open camera detections. ⇒ لا توجد كشوفات كاميرا مفتوحة.
Critical ⇒ حرج
High ⇒ عالي
Medium ⇒ متوسط
Low ⇒ منخفض
General ⇒ عامة
Sensitive area ⇒ منطقة حساسة
LIVE ⇒ مباشر
Test videos · AI analysis ⇒ فيديوهات الاختبار · تحليل الذكاء الاصطناعي
Test ⇒ اختبار
Upload a video for a situation and the AI analyses it like a live camera: what it finds appears under the video and in Current detections, marked TEST VIDEO. The video stays on this computer. ⇒ ارفع فيديو لأي حالة ويحلّله الذكاء الاصطناعي مثل كاميرا مباشرة: اللي يكتشفه يظهر تحت الفيديو وفي الكشوفات الحالية بعلامة «فيديو اختبار». الفيديو يبقى على هذا الجهاز.
Fire ⇒ حريق
Smoke ⇒ دخان
Flames, a burning car or building ⇒ لهب، سيارة أو مبنى يحترق
Smoke rising, a smoky room ⇒ دخان يتصاعد، غرفة فيها دخان
Armed person ⇒ شخص مسلّح
Someone holding a pistol, rifle or knife ⇒ شخص يحمل مسدس أو بندقية أو سكين
Smoking ⇒ تدخين
Someone smoking a cigarette ⇒ شخص يدخّن سيجارة
Crowd · people count ⇒ زحام · عدد الأشخاص
A busy entrance, a queue, a hall ⇒ مدخل مزدحم، طابور، قاعة
Behaviour ⇒ السلوك
Running, a fall, loitering, circling ⇒ ركض، سقوط، تسكّع، دوران حول المكان
Drop a video here ⇒ اسحب فيديو هنا
or click to choose one ⇒ أو اضغط لاختيار فيديو
Another video ⇒ فيديو آخر
Remove ⇒ إزالة
{0} people in view ⇒ {0} شخص ظاهر
{0} close looks (OWLv2) ⇒ {0} نظرة مقرّبة (OWLv2)
Nothing found yet — the AI is still watching. ⇒ ما انكشف شي للحين — الذكاء الاصطناعي يراقب.
Starting the analysis… ⇒ جارٍ بدء التحليل…
Test · Fire ⇒ اختبار · حريق
Test · Smoke ⇒ اختبار · دخان
Test · Armed person ⇒ اختبار · شخص مسلّح
Test · Smoking ⇒ اختبار · تدخين
Test · Crowd · people count ⇒ اختبار · زحام
Test · Behaviour ⇒ اختبار · السلوك
TEST VIDEO ⇒ فيديو اختبار
{0} · checking ⇒ {0} · قيد التحقق
`;
