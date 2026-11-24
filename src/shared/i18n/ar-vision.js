// Arabic dictionary — fire, smoke and gas analytics, camera zones and presence, SAWN WHAT-IF.
// Format: "English ⇒ Arabic"; {0}, {1}… are variable parts (see ../i18n.js).
export default `
Fire, smoke and gas ⇒ الحريق والدخان والغاز
Fire (camera) ⇒ حريق (كاميرا)
Smoke (camera) ⇒ دخان (كاميرا)
Gas leak (OGI camera) ⇒ تسرب غاز (كاميرا OGI)
Fire detected (camera) ⇒ اكتُشف حريق (كاميرا)
Smoke detected (camera) ⇒ اكتُشف دخان (كاميرا)
Methane leak (OGI camera) ⇒ تسرب ميثان (كاميرا OGI)
Level 3 · Warehouses ⇒ المستوى 3 · المستودعات
D · Gas meter room ⇒ D · غرفة عدادات الغاز
Video inference: visible flames at the base of rack 4 in camera W3, growing over 6 s and confirmed in 5 consecutive frames. Flame detection sees only visible fire; send someone to check and start the fire plan. ⇒ استنتاج الفيديو: لهب ظاهر عند قاعدة الرف 4 في الكاميرا W3، يتزايد خلال 6 ثوانٍ ومؤكد في 5 إطارات متتالية. كشف اللهب يرى الحريق الظاهر فقط؛ أرسل شخصًا للتحقق وابدأ خطة الحريق.
Video inference: a grey plume rising from the packing area in camera W3 for 25 s, spreading towards the ceiling. Smoke can come from fire, dust or steam; check the area before raising the fire alarm. ⇒ استنتاج الفيديو: عمود رمادي يتصاعد من منطقة التغليف في الكاميرا W3 لمدة 25 ثانية، وينتشر نحو السقف. قد يأتي الدخان من حريق أو غبار أو بخار؛ تحقق من المنطقة قبل إطلاق إنذار الحريق.
Segmentation of the optical gas imaging (OGI) video shows a methane plume leaving the regulator flange on the meter skid, growing for 20 s and drifting east. Keep ignition sources away, isolate the supply if it is safe, and call the gas emergency number. ⇒ يُظهر تقسيم فيديو التصوير البصري للغاز (OGI) سحابة ميثان تخرج من شفة المنظّم على منصة العدادات، تتزايد خلال 20 ثانية وتنجرف شرقًا. أبعد مصادر الاشتعال، واعزل الإمداد إن كان ذلك آمنًا، واتصل برقم طوارئ الغاز.
W3 frames with flame region (5 of 5) ⇒ إطارات W3 بها منطقة لهب (5 من 5)
Flame area grew from 0.4 % to 1.8 % of the frame ⇒ زادت مساحة اللهب من 0.4٪ إلى 1.8٪ من الإطار
Rack 4 · east aisle ⇒ الرف 4 · الممر الشرقي
W3 · first flame region ⇒ W3 · أول منطقة لهب
W3 · region growing ⇒ W3 · المنطقة تتسع
W3 · confirmed in 5 frames ⇒ W3 · مؤكد في 5 إطارات
W3 · snapshot saved ⇒ W3 · حُفظت لقطة
W3 smoke region present for 25 s ⇒ منطقة دخان في W3 لمدة 25 ثانية
Region spreading upwards (×3 in area) ⇒ المنطقة تنتشر للأعلى (المساحة ×3)
No flame visible yet ⇒ لا يظهر لهب بعد
W3 · faint haze ⇒ W3 · ضباب خفيف
W3 · plume spreading ⇒ W3 · العمود ينتشر
W3 · smoke persists 25 s ⇒ W3 · الدخان مستمر 25 ثانية
OG-1 plume mask over 20 s ⇒ قناع السحابة في OG-1 خلال 20 ثانية
Plume area 2.1 % → 6.4 % of the frame ⇒ مساحة السحابة 2.1٪ ← 6.4٪ من الإطار
Source: regulator flange, drift east ⇒ المصدر: شفة المنظّم، الانجراف شرقًا
OG-1 · plume first segmented ⇒ OG-1 · أول تقسيم للسحابة
OG-1 · plume growing ⇒ OG-1 · السحابة تتزايد
OG-1 · leak confirmed ⇒ OG-1 · تأكد التسرب
D4 · warning light ⇒ D4 · ضوء التحذير
Camera ⇒ الكاميرا
Model class ⇒ فئة النموذج
Frames confirming ⇒ الإطارات المؤكِّدة
Persistence ⇒ الاستمرار
Gas ⇒ الغاز
Plume area ⇒ مساحة السحابة
Drift ⇒ الانجراف
flame ⇒ لهب
smoke ⇒ دخان
east ⇒ شرق
Methane (CH4) ⇒ ميثان (CH4)
W3 · Warehouse ⇒ W3 · المستودع
OG-1 · OGI ⇒ OG-1 · OGI
Warehouse camera (fire & smoke) ⇒ كاميرا المستودع (حريق ودخان)
OGI gas camera ⇒ كاميرا الغاز OGI
W3 · Warehouse (fire & smoke) ⇒ W3 · المستودع (حريق ودخان)
OG-1 · Gas meter room (OGI) ⇒ OG-1 · غرفة عدادات الغاز (OGI)
No flame or smoke detected ⇒ لم يُكتشف لهب أو دخان
OGI · no gas plume segmented ⇒ OGI · لم تُقسَّم أي سحابة غاز
CH4 plume {0} · drift → ⇒ سحابة CH4 ‏{0} · انجراف ←
flame {0} ⇒ لهب {0}
smoke {0} ⇒ دخان {0}
Fire, smoke and gas pictures come from the Simulator (group “Fire, smoke and gas”). On B1 and CAM-2, a shift supervisor draws restricted zones: everyone who enters is identified by badge, checked against People & cards and logged below. ⇒ صور الحريق والدخان والغاز تأتي من المحاكي (مجموعة «الحريق والدخان والغاز»). على B1 وCAM-2 يرسم مشرف المناوبة مناطق محظورة: كل من يدخل يُعرَّف ببطاقته ويُطابق مع الأشخاص والبطاقات ويُسجَّل أدناه.

CAMERA ANALYTICS ⇒ تحليلات الكاميرا
Camera analytics ⇒ تحليلات الكاميرا
Camera zones · who entered and how long they stayed ⇒ مناطق الكاميرا · من دخل وكم بقي
In ⇒ دخول
Out ⇒ خروج
Camera · zone ⇒ الكاميرا · المنطقة
Badge ⇒ الشارة
Check ⇒ التحقق
Stay ⇒ مدة البقاء
inside ⇒ بالداخل
Not authorized ⇒ غير مصرّح
Unidentified ⇒ غير معروف الهوية
Nobody has entered a camera zone yet. Draw a zone on B1 or CAM-2 to start. ⇒ لم يدخل أحد منطقة كاميرا بعد. ارسم منطقة على B1 أو CAM-2 للبدء.
No zones ⇒ لا توجد مناطق
Draw zone ⇒ رسم منطقة
Remove zones ⇒ إزالة المناطق
Finish ⇒ إنهاء
Click the corners on the picture ({0} so far) ⇒ اضغط على زوايا المنطقة في الصورة ({0} حتى الآن)
Click at least three corners on the picture. ⇒ اضغط على ثلاث زوايا على الأقل في الصورة.
New zone · {0} ⇒ منطقة جديدة · {0}
Zone name ⇒ اسم المنطقة
e.g. Staff door ⇒ مثال: باب الموظفين
Who may enter ⇒ من يُسمح له بالدخول
Level {0} or higher ⇒ المستوى {0} أو أعلى
Longest allowed stay in seconds (0 = no limit) ⇒ أطول مدة بقاء مسموحة بالثواني (0 = بلا حد)
Allowed hours (optional, e.g. 7-19) ⇒ الساعات المسموحة (اختياري، مثال 7-19)
Save zone ⇒ حفظ المنطقة
Zone “{0}” saved. ⇒ تم حفظ المنطقة «{0}».
Zones removed. ⇒ تمت إزالة المناطق.
Remove the zones of {0}? ⇒ إزالة مناطق {0}؟
Entries are no longer checked on this camera. The presence log stays. ⇒ لن يُتحقق من الدخول على هذه الكاميرا بعد الآن. يبقى سجل الحضور.
ID {0} · authorized ⇒ رقم {0} · مصرّح
ID {0} · no clearance ⇒ رقم {0} · بلا تصريح
{0} · L{1}+ ⇒ {0} · م{1}+
person · no clearance ⇒ شخص · بلا تصريح
person · long stay ⇒ شخص · بقاء طويل
Restricted-zone entry (camera) ⇒ دخول منطقة مقيدة (كاميرا)
Long stay in a camera zone ⇒ بقاء طويل في منطقة كاميرا
Camera zone ⇒ منطقة الكاميرا
Required level ⇒ المستوى المطلوب
Camera zones changed ⇒ تغيّرت مناطق الكاميرا
Unknown camera ⇒ كاميرا غير معروفة
No badge read (RFID) — unidentified person ⇒ لم تُقرأ شارة (RFID) — شخص مجهول الهوية
Card {0} is {1} ⇒ البطاقة {0} {1}
Card {0} is not assigned to anyone ⇒ البطاقة {0} غير مخصصة لأحد
{0} is suspended ⇒ {0} موقوف
{0}'s access ended ⇒ انتهت صلاحية {0}
{0} is cleared to Level {1}; the zone needs Level {2} ⇒ {0} مصرّح حتى المستوى {1}؛ والمنطقة تتطلب المستوى {2}
{0} is outside the zone's allowed hours ({1}:00–{2}:00) ⇒ {0} خارج الساعات المسموحة للمنطقة ({1}:00–{2}:00)
{0} · Level {1} · card {2} ⇒ {0} · المستوى {1} · البطاقة {2}
Exit not recorded (server restarted) ⇒ لم يُسجَّل الخروج (أُعيد تشغيل الخادم)
Camera {0} tracked a person (track {1}) into “{2}”, which needs Level {3}. {4}. ⇒ تتبعت الكاميرا {0} شخصًا (المسار {1}) إلى داخل «{2}» التي تتطلب المستوى {3}. {4}.
{0} track {1} entered “{2}” ⇒ {0} المسار {1} دخل «{2}»
Badge read: {0} ⇒ قراءة الشارة: {0}
No badge read ⇒ لم تُقرأ شارة
{0} has been in “{1}” for {2} s; the zone allows {3} s. ⇒ بقي {0} في «{1}» لمدة {2} ثانية؛ والمنطقة تسمح بـ {3} ثانية.
An unidentified person ⇒ شخص مجهول الهوية
{0} track {1} inside “{2}” for {3} s ⇒ {0} المسار {1} داخل «{2}» لمدة {3} ثانية
Limit {0} s ⇒ الحد {0} ثانية
active ⇒ نشطة
revoked ⇒ ملغاة
suspended ⇒ موقوفة

SAWN WHAT-IF · scenario analysis ⇒ SAWN ماذا لو · تحليل السيناريوهات
Pick a situation and what is not working: SAWN shows who would handle it, how the response would unfold, what the failures change and the recommended steps. Nothing is created unless you run it as a training scenario. ⇒ اختر موقفًا وما الذي لا يعمل: يعرض SAWN من سيتعامل معه، وكيف ستجري الاستجابة، وما الذي تغيّره الأعطال، والخطوات الموصى بها. لا يُنشأ شيء إلا إذا شغّلته كسيناريو تدريبي.
Situation ⇒ الموقف
What is not working ⇒ ما الذي لا يعمل
Run as training scenario ⇒ تشغيل كسيناريو تدريبي
Training incident {0} created — see Incidents. ⇒ أُنشئت الحادثة التدريبية {0} — راجع الحوادث.
Who handles it ⇒ من يتعامل معها
Response deadline ⇒ مهلة الاستجابة
Responders available ⇒ المستجيبون المتاحون
{0} of {1} ⇒ {0} من {1}
{0} of {1} (night: about half on site) ⇒ {0} من {1} (ليلًا: نحو النصف في الموقع)
{0} min ⇒ {0} دقيقة
How the response would unfold ⇒ كيف ستجري الاستجابة
Risks ⇒ المخاطر
No particular risk found for this situation. ⇒ لم يُعثر على خطر خاص في هذا الموقف.
What the failures change ⇒ ما الذي تغيّره الأعطال
Everything working. ⇒ كل شيء يعمل.
Recommended steps ⇒ الخطوات الموصى بها
No matching contact in the list — an administrator adds them under Users & roles. ⇒ لا توجد جهة مطابقة في القائمة — يضيفها مدير النظام من «المستخدمون والأدوار».
Detected: “{0}” at {1} ({2}) ⇒ اكتُشف: «{0}» في {1} ({2})
{0} paged: {1} ⇒ أُبلغ {0}: {1}
nobody ⇒ لا أحد
If nobody has responded: shift supervisors alerted ⇒ إذا لم يستجب أحد: يُنبَّه مشرفو المناوبة
Still nobody: supervisors alerted again ⇒ لا يزال لا أحد: يُنبَّه المشرفون مرة أخرى
Nobody is in the {0} team — every responder is paged instead. Put people in the team under Users & roles. ⇒ لا يوجد أحد في فريق {0} — يُبلَّغ كل المستجيبين بدلًا من ذلك. أضف أشخاصًا للفريق من «المستخدمون والأدوار».
Nobody would be paged: no active user can handle incidents. ⇒ لن يُبلَّغ أحد: لا يوجد مستخدم نشط يمكنه التعامل مع الحوادث.
Only one responder: if they are busy, nobody responds before the deadline. ⇒ مستجيب واحد فقط: إذا كان مشغولًا فلن يستجيب أحد قبل المهلة.
Critical: closing it as a false alarm needs a second approver (two-person rule). ⇒ حرجة: إغلاقها كإنذار كاذب يتطلب موافقًا ثانيًا (قاعدة الشخصين).
The drone is a key check here and it is unavailable. ⇒ المسيّرة وسيلة تحقق أساسية هنا وهي غير متاحة.
This situation is detected by the airspace sensor — with it offline it would not be detected at all. ⇒ هذا الموقف يكتشفه مستشعر المجال الجوي — ومع تعطله لن يُكتشف أبدًا.
Central directory unreachable ⇒ الدليل المركزي غير متاح
Airspace sensor offline ⇒ مستشعر المجال الجوي غير متصل
Face camera down ⇒ كاميرا الوجه معطّلة
Metal detector down ⇒ كاشف المعادن معطّل
Network cut (nodes on USB) ⇒ انقطاع الشبكة (العُقد على USB)
Drone unavailable ⇒ المسيّرة غير متاحة
Night shift (fewer people on site) ⇒ مناوبة ليلية (عدد أقل في الموقع)
Gate A decides from its local directory copy; after its validity runs out, identity checks fail secure (officer checks by hand). ⇒ تقرر البوابة A من نسختها المحلية من الدليل؛ وبعد انتهاء صلاحيتها يُغلق التحقق من الهوية بأمان (يتحقق الضابط يدويًا).
The airspace stage at Gate A goes to an officer: devices are checked by hand; no wireless incidents are raised. ⇒ تُحال مرحلة المجال الجوي في البوابة A إلى ضابط: يُتحقق من الأجهزة يدويًا؛ ولا تُنشأ حوادث لاسلكية.
The face stage goes to an officer, who compares the person with the ID photo. ⇒ تُحال مرحلة الوجه إلى ضابط يقارن الشخص بصورة الهوية.
Manual search at the checkpoint; switched-off devices are not found automatically. ⇒ تفتيش يدوي عند نقطة التفتيش؛ ولا تُكتشف الأجهزة المطفأة تلقائيًا.
Nodes fall back to USB; consoles still get incidents. Expect a few seconds of delay. ⇒ تنتقل العُقد إلى USB؛ وتستمر وحدات التحكم في تلقي الحوادث. توقّع تأخيرًا لبضع ثوانٍ.
No aerial check: send a guard instead and use T-1 and the perimeter cameras. ⇒ لا تحقق جوي: أرسل حارسًا بدلًا من ذلك واستخدم T-1 وكاميرات المحيط.
Fewer responders: assign early; supervisors are alerted at the deadline if nobody responds. ⇒ مستجيبون أقل: أسند مبكرًا؛ ويُنبَّه المشرفون عند المهلة إذا لم يستجب أحد.

Open the incident and acknowledge it so the clock stops ⇒ افتح الحادثة واستلمها ليتوقف العدّاد
Assign the nearest officer; check the camera picture and access records ⇒ أسندها لأقرب ضابط؛ وتحقق من صورة الكاميرا وسجلات الدخول
Send the drone if the place is outdoors or hard to reach ⇒ أرسل المسيّرة إذا كان المكان خارجيًا أو يصعب الوصول إليه
Confirm or dismiss with a reason; escalate to the supervisor if unsure ⇒ أكّد أو استبعد مع ذكر السبب؛ وصعّد إلى المشرف إذا لم تكن متأكدًا
Acknowledge and assign the safety officer on duty ⇒ استلمها وأسندها لضابط السلامة المناوب
Check the camera picture before raising the building alarm ⇒ تحقق من صورة الكاميرا قبل إطلاق إنذار المبنى
Keep people away; start the evacuation plan if it is confirmed ⇒ أبعد الناس؛ وابدأ خطة الإخلاء إذا تأكد الأمر
Call the fire / gas authority if it is confirmed or growing ⇒ اتصل بجهة الحريق / الغاز إذا تأكد الأمر أو كان يتفاقم
Acknowledge immediately and assign two responders ⇒ استلمها فورًا وأسند مستجيبَين اثنين
Hold the person and the item; keep the area clear ⇒ احتجز الشخص والغرض؛ وأخلِ المنطقة
Call the response team and the police ⇒ اتصل بفريق الاستجابة والشرطة
Do not close it alone: a critical dismissal needs a second approver ⇒ لا تغلقها وحدك: استبعاد الحادثة الحرجة يتطلب موافقًا ثانيًا
Raise the fire alarm and evacuate Level 3 ⇒ أطلق إنذار الحريق وأخلِ المستوى 3
Use an extinguisher only if it is small and safe to do so ⇒ استخدم الطفاية فقط إذا كان الحريق صغيرًا وآمنًا
Call Civil Defense; meet them at the gate with the floor plan ⇒ اتصل بالدفاع المدني؛ واستقبلهم عند البوابة بمخطط الطابق
Cut power to the affected racks if the plan says so ⇒ افصل الكهرباء عن الرفوف المتأثرة إذا نصّت الخطة على ذلك
Send someone to look before raising the alarm (dust or steam look the same on camera) ⇒ أرسل شخصًا للتحقق قبل إطلاق الإنذار (الغبار أو البخار يبدوان متشابهين في الكاميرا)
If it is smoke from a fire: follow the fire steps ⇒ إذا كان دخانًا من حريق: اتبع خطوات الحريق
Ventilate only if there is no fire ⇒ هوِّ المكان فقط إذا لم يكن هناك حريق
Keep every ignition source away: no switches, no phones in the room ⇒ أبعد كل مصادر الاشتعال: لا مفاتيح كهربائية ولا هواتف في الغرفة
Close the supply valve only if it is safe to reach ⇒ أغلق صمام الإمداد فقط إذا كان الوصول إليه آمنًا
Evacuate Zone D and keep people upwind ⇒ أخلِ المنطقة D وأبقِ الناس في عكس اتجاه الريح
Call the gas emergency number and Civil Defense ⇒ اتصل برقم طوارئ الغاز والدفاع المدني
Hold the person and the bag at the checkpoint ⇒ احتجز الشخص والحقيبة عند نقطة التفتيش
Keep 100 m clear around the bag ⇒ أخلِ مسافة 100 م حول الحقيبة
Call the response team and the police — the screener does not decide alone ⇒ اتصل بفريق الاستجابة والشرطة — المفتش لا يقرر وحده
Do not approach alone; keep sight of the person ⇒ لا تقترب وحدك؛ وأبقِ الشخص تحت النظر
Lock down the doors between the person and others ⇒ أغلق الأبواب بين الشخص والآخرين
Call the police ⇒ اتصل بالشرطة
Send two officers; check the camera first ⇒ أرسل ضابطين؛ وتحقق من الكاميرا أولًا
Separate the people and call first aid if needed ⇒ افصل بين الأشخاص واستدعِ الإسعافات الأولية عند الحاجة
Track the person with T-1 and the perimeter cameras ⇒ تتبّع الشخص بـ T-1 وكاميرات المحيط
Send the drone and the nearest guard ⇒ أرسل المسيّرة وأقرب حارس
Lock Gate A and the level doors until the person is found ⇒ أغلق البوابة A وأبواب المستويات حتى يُعثر على الشخص
Send a guard to talk to the person politely ⇒ أرسل حارسًا للتحدث مع الشخص بلباقة
Keep the camera track and save the clips ⇒ احتفظ بتتبع الكاميرا واحفظ المقاطع
Note the operator position from Remote ID ⇒ سجّل موقع المشغّل من المعرّف عن بُعد
Inform the police; drones are not allowed over the site ⇒ أبلغ الشرطة؛ المسيّرات غير مسموح بها فوق الموقع
Move people indoors if the drone is low over them ⇒ أدخل الناس إلى الداخل إذا كانت المسيّرة منخفضة فوقهم
Send an officer to the Level 4 door now ⇒ أرسل ضابطًا إلى باب المستوى 4 الآن
Check camera G4 and who badged in last ⇒ تحقق من الكاميرا G4 ومن مرّر شارته آخرًا
Check the camera picture and who it is ⇒ تحقق من صورة الكاميرا ومن هو الشخص
Ask the person to leave the zone or escort them out ⇒ اطلب من الشخص مغادرة المنطقة أو رافقه للخارج
If the badge is wrong or missing: hold them and check their ID ⇒ إذا كانت الشارة خاطئة أو مفقودة: احتجزه وتحقق من هويته
`;
