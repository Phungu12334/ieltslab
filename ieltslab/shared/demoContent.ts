// Original demo content written for IELTSLab. It follows publicly described IELTS task formats
// but is NOT official IELTS material. Every item is marked demo: true and tagged "demo".
import { esc, g, mat, q, svgData } from './contentKit';
import { MORE_MATERIALS } from './demoContentMore';
import type { Material } from './types';

// ---------- Simple chart images for Writing Task 1 (static SVG, rendered as <img>) ----------
function barChart(): string {
  const cats = ['Watching TV', 'Online video', 'Reading', 'Sport & exercise'];
  const a = [15, 2, 6, 3];
  const b = [9, 14, 4, 5];
  const W = 640, H = 380, left = 60, bottom = 320, top = 50, max = 16;
  const y = (v: number) => bottom - ((bottom - top) * v) / max;
  const groupW = (W - left - 30) / cats.length;
  let bars = '';
  cats.forEach((c, i) => {
    const x0 = left + i * groupW + groupW / 2 - 44;
    bars += `<rect x="${x0}" y="${y(a[i])}" width="40" height="${bottom - y(a[i])}" fill="#7d93ad"/>`;
    bars += `<rect x="${x0 + 46}" y="${y(b[i])}" width="40" height="${bottom - y(b[i])}" fill="#1b4f8a"/>`;
    bars += `<text x="${x0 + 20}" y="${y(a[i]) - 6}" font-size="12" text-anchor="middle" fill="#14202e">${a[i]}</text>`;
    bars += `<text x="${x0 + 66}" y="${y(b[i]) - 6}" font-size="12" text-anchor="middle" fill="#14202e">${b[i]}</text>`;
    bars += `<text x="${x0 + 43}" y="${bottom + 22}" font-size="13" text-anchor="middle" fill="#14202e">${esc(c)}</text>`;
  });
  let grid = '';
  for (let v = 0; v <= max; v += 4) {
    grid += `<line x1="${left}" x2="${W - 20}" y1="${y(v)}" y2="${y(v)}" stroke="#d5dbe3"/>`;
    grid += `<text x="${left - 10}" y="${y(v) + 4}" font-size="12" text-anchor="end" fill="#3d4a5a">${v}</text>`;
  }
  return svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif"><rect width="${W}" height="${H}" fill="#ffffff"/>
<text x="${W / 2}" y="24" font-size="15" font-weight="bold" text-anchor="middle" fill="#14202e">Average hours per week spent on leisure activities, Country X</text>
${grid}${bars}
<text x="18" y="${(top + bottom) / 2}" font-size="12" fill="#3d4a5a" transform="rotate(-90 18 ${(top + bottom) / 2})" text-anchor="middle">Hours per week</text>
<rect x="${W - 190}" y="${H - 26}" width="12" height="12" fill="#7d93ad"/><text x="${W - 172}" y="${H - 16}" font-size="12" fill="#14202e">2000</text>
<rect x="${W - 120}" y="${H - 26}" width="12" height="12" fill="#1b4f8a"/><text x="${W - 102}" y="${H - 16}" font-size="12" fill="#14202e">2020</text>
</svg>`);
}

function lineChart(): string {
  const years = [2015, 2017, 2019, 2021, 2023, 2025];
  const series = [
    { name: 'Science museum', color: '#1b4f8a', dash: '', v: [420, 450, 480, 260, 430, 510] },
    { name: 'Art gallery', color: '#b26b00', dash: '6 4', v: [300, 310, 330, 150, 340, 390] },
    { name: 'History museum', color: '#1e7a46', dash: '2 3', v: [510, 490, 470, 220, 380, 400] },
  ];
  const W = 640, H = 380, left = 64, right = 30, top = 50, bottom = 300, max = 600;
  const x = (i: number) => left + (i * (W - left - right)) / (years.length - 1);
  const y = (v: number) => bottom - ((bottom - top) * v) / max;
  let out = '';
  for (let v = 0; v <= max; v += 100) {
    out += `<line x1="${left}" x2="${W - right}" y1="${y(v)}" y2="${y(v)}" stroke="#d5dbe3"/>`;
    out += `<text x="${left - 10}" y="${y(v) + 4}" font-size="12" text-anchor="end" fill="#3d4a5a">${v}</text>`;
  }
  years.forEach((yr, i) => (out += `<text x="${x(i)}" y="${bottom + 20}" font-size="12" text-anchor="middle" fill="#14202e">${yr}</text>`));
  series.forEach((s, si) => {
    out += `<polyline fill="none" stroke="${s.color}" stroke-width="3" stroke-dasharray="${s.dash}" points="${s.v.map((v, i) => `${x(i)},${y(v)}`).join(' ')}"/>`;
    s.v.forEach((v, i) => (out += `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${s.color}"/>`));
    const lx = left + si * 190;
    out += `<line x1="${lx}" x2="${lx + 28}" y1="${H - 26}" y2="${H - 26}" stroke="${s.color}" stroke-width="3" stroke-dasharray="${s.dash}"/><text x="${lx + 36}" y="${H - 22}" font-size="12" fill="#14202e">${esc(s.name)}</text>`;
  });
  return svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif"><rect width="${W}" height="${H}" fill="#ffffff"/>
<text x="${W / 2}" y="24" font-size="15" font-weight="bold" text-anchor="middle" fill="#14202e">Annual visitors to three museums in one city (thousands)</text>
<text x="18" y="${(top + bottom) / 2}" font-size="12" fill="#3d4a5a" transform="rotate(-90 18 ${(top + bottom) / 2})" text-anchor="middle">Visitors (000s)</text>
${out}</svg>`);
}

// ---------------------------------- LISTENING ----------------------------------
const L_P1_A_SCRIPT = `RECEPTIONIST: Good morning, Riverside Sports Centre, Hannah speaking. How can I help?
CALLER: Hi. I'm thinking of joining the centre and I wanted to ask about memberships.
RECEPTIONIST: Of course. Can I take your name first?
CALLER: Yes, it's Daniel Okafor. That's O-K-A-F-O-R.
RECEPTIONIST: Thank you, Mr Okafor. Are you interested in full membership, or just the swimming pool?
CALLER: Well, mainly the pool, but I'd also like to use the gym now and then.
RECEPTIONIST: Then the one I'd recommend is our Flexi membership. It's thirty-two pounds a month, and it covers the pool and the gym, though not the fitness classes.
CALLER: Thirty-two. Is there a joining fee?
RECEPTIONIST: Normally there's a fee of twenty pounds, but this month it's free if you sign up online.
CALLER: Great. And what are the opening hours for the pool?
RECEPTIONIST: On weekdays it opens at six thirty in the morning and closes at ten at night. At weekends it's eight till six.
CALLER: Is there anything I need to bring for my first visit?
RECEPTIONIST: Yes. You'll need a photo for your membership card, and some proof of address, such as a bank statement.
CALLER: OK. What about parking?
RECEPTIONIST: Parking is free for members, but the car park is quite small, so most of our members actually come by bike. There's a covered bike rack next to the main entrance.
CALLER: Good to know. And one last thing. I've heard you do an introductory session?
RECEPTIONIST: That's right. Every new member gets a free induction with one of our trainers. It lasts about forty-five minutes, and they'll show you how to use the equipment safely.
CALLER: Perfect. I'll sign up online this evening, then. Thanks for your help.`;

const L_P1_B_SCRIPT = `ADVISOR: Hello, Westbrook College enrolments. How can I help?
CALLER: Hi, I'd like to enrol on an evening course, please. Photography for beginners.
ADVISOR: Certainly. That course runs on Tuesdays, starting on the ninth of January, for ten weeks.
CALLER: And what time does it start?
ADVISOR: At seven fifteen, and it finishes at nine.
CALLER: What does it cost?
ADVISOR: It's one hundred and twenty pounds, or ninety-five if you're over sixty or a student.
CALLER: I'm a student, actually. Do I need my own camera?
ADVISOR: You can use a phone for the first few weeks, but from week four you'll need a camera with manual settings. If you don't have one, we can lend you one for a deposit of forty pounds.
CALLER: Where are the classes held?
ADVISOR: In the Arts Building, room B12. That's on the ground floor, near the café.
CALLER: Lovely. Could I have your name in case I need to call back?
ADVISOR: Of course. It's Marta. M-A-R-T-A.
CALLER: Thanks, Marta. I'll fill in the form today.`;

const L_P2_SCRIPT = `GUIDE: Good afternoon, everyone, and welcome to Harbourside Community Garden. My name's Priya, and I'm one of the volunteer coordinators. Before you start exploring, let me tell you a little about how the garden works.
GUIDE: The garden was created twelve years ago on the site of an old car park. At first there were just ten raised beds. Today we have more than ninety, and they're looked after by local families, two primary schools and a care home.
GUIDE: If you look at the map in your leaflet, you'll see the entrance gate at the bottom. Directly opposite the gate is the greenhouse, where we grow seedlings in early spring. To the left of the greenhouse you'll find the herb spiral. Please feel free to smell the plants, but we ask you not to pick them.
GUIDE: Beyond the herb spiral, in the far left corner, is the pond. It was dug by volunteers three years ago and it's now home to frogs and dragonflies. Children must be supervised by an adult there at all times.
GUIDE: On the right-hand side of the garden is the tool shed. Volunteers can borrow tools free of charge, but they must sign them out in the book by the door. Next to the shed is the compost area, and here's something new: we've just started collecting used coffee grounds from three cafés on the high street, which add nitrogen to our compost.
GUIDE: Now, a few words about volunteering. Our busiest time is Saturday morning, when we run a work party from nine until twelve. You don't need any experience. We provide gloves, and there's always someone to show you what to do. The only thing we ask is that you wear sturdy shoes.
GUIDE: Finally, every September we hold a harvest festival. Last year we raised over two thousand pounds for a new rainwater collection system, which will be installed next spring.`;

const L_P3_SCRIPT = `TUTOR: So, Leo and Amira, how's the project on noise in student accommodation going?
LEO: Quite well, I think. We've finished collecting the data from the three halls of residence.
TUTOR: Good. How did you measure the noise in the end?
AMIRA: We'd planned to use the sound meters from the physics department, but they were all booked for the whole month. So we used a free phone app instead. We checked it against one of the meters first, and the readings were within two decibels.
TUTOR: That's sensible. And what did you find?
LEO: The most surprising thing was that the noisiest hall wasn't the one next to the main road. It was Kingsley Hall, which is on a quiet street. The problem there is inside the building. The corridors have hard floors and no carpets, so footsteps and doors echo.
TUTOR: Interesting. Did you survey the students as well?
AMIRA: Yes, we got sixty-four responses. Most students said noise affected their sleep more than their studying, which we didn't expect.
TUTOR: Why not?
AMIRA: Well, we assumed people worked in their rooms. But most of them study in the library, so they're not at home in the early evening when it's loudest.
TUTOR: Right. Now, for the recommendations section, what are you thinking?
LEO: I wanted to recommend carpets for Kingsley, but Amira pointed out that they're expensive to clean.
AMIRA: So we're going to suggest rubber door closers instead. They're cheap, and the survey showed that slamming doors was the number-one complaint.
TUTOR: That's a practical recommendation. One thing I'd add: your literature review is a bit thin. You need at least two more recent studies.
LEO: OK. We'll look for some from the last five years.
TUTOR: And remember, the deadline has moved. It's now the fourteenth of May, not the seventh.`;

const L_P4_SCRIPT = `LECTURER: Today I want to look at a material that is attracting growing interest from engineers: bamboo. Although we often think of it as a tree, bamboo is actually a type of grass, and some species can grow almost a metre in a single day. This rapid growth is one reason it is described as a renewable resource. A bamboo plantation can be harvested after three to five years, whereas most timber trees take several decades.
LECTURER: In terms of strength, bamboo performs surprisingly well. Its tensile strength, that is, its resistance to being pulled apart, is comparable to that of some types of steel. This is because the fibres run along the length of the stem. However, bamboo is much weaker when force is applied across the fibres, which means it can split if it is nailed. Builders therefore traditionally join bamboo using rope or wooden pegs rather than nails.
LECTURER: The biggest problem with bamboo is durability. Untreated bamboo contains a lot of starch, which attracts insects, particularly beetles. In the past, communities soaked the stems in water for several weeks to wash the starch out. Today, the most common method is to treat bamboo with a solution of boron salts, which is relatively safe for humans.
LECTURER: Another challenge is that bamboo stems vary in diameter and thickness, which makes it hard to produce standard components. One solution is engineered bamboo. The stems are cut into strips, which are then glued and pressed into boards or beams. These products look similar to timber and can be used in the same way.
LECTURER: Finally, let us consider the environmental picture. Bamboo absorbs carbon quickly as it grows, but much of it is grown in Asia, so transport can cancel out some of the benefits in Europe or North America. For this reason, researchers are experimenting with growing hardy species in cooler climates.`;

const LISTENING: Material[] = [
  mat('demo-l1-sports', 'listening', 'both', 1, 'Joining a sports centre', 'You will hear a telephone conversation between a receptionist and a man who wants to join a sports centre.', {
    audioScript: L_P1_A_SCRIPT,
    transcript: L_P1_A_SCRIPT,
    tags: ['membership', 'everyday'],
    groups: [
      g('completion', 'Complete the notes below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.', [
        q("Caller's surname: ______", ['Okafor'], 'He spells it: O-K-A-F-O-R.'),
        q('Recommended membership: ______', ['Flexi', 'Flexi membership'], 'The receptionist recommends the "Flexi membership".'),
        q('Monthly cost: £______', ['32', 'thirty-two', 'thirty two'], 'It costs thirty-two pounds a month. The £20 joining fee is a distractor.'),
        q('Joining fee is free if you sign up ______', ['online'], 'The fee is waived "if you sign up online" this month.'),
        q('Pool opens on weekdays at ______ a.m.', ['6.30', '6:30', 'six thirty', '630'], 'Weekdays: six thirty in the morning. 8 a.m. is the weekend time.'),
        q('For the first visit, bring a photo and proof of ______', ['address'], 'A bank statement is given as an example of proof of address.'),
      ], { maxWords: 2 }),
      g('mcq', 'Choose the correct letter, A, B or C.', [
        q('How do most members travel to the centre?', ['C'], 'The car park is small, "so most of our members actually come by bike."', ['by car', 'by bus', 'by bike']),
        q('How long is the induction session?', ['B'], 'It lasts "about forty-five minutes".', ['30 minutes', '45 minutes', 'an hour']),
      ]),
    ],
  }),
  mat('demo-l1-college', 'listening', 'both', 1, 'Enrolling on an evening course', 'You will hear a student phoning a college to enrol on a photography course.', {
    audioScript: L_P1_B_SCRIPT,
    transcript: L_P1_B_SCRIPT,
    tags: ['education', 'everyday'],
    groups: [
      g('completion', 'Complete the form below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.', [
        q('Day of the course: ______', ['Tuesday', 'Tuesdays'], 'The course "runs on Tuesdays".'),
        q('Start time: ______ p.m.', ['7.15', '7:15', 'seven fifteen', '715'], 'It starts at seven fifteen and finishes at nine.'),
        q('Price for students: £______', ['95', 'ninety-five', 'ninety five'], '£120 is the full price; students and over-60s pay £95.'),
        q('A manual camera is needed from week ______', ['4', 'four'], '"From week four you\'ll need a camera with manual settings."'),
        q('Deposit to borrow a camera: £______', ['40', 'forty'], 'A deposit of forty pounds.'),
        q('Room: Arts Building, ______', ['B12'], 'Room B12, on the ground floor near the café.'),
        q("Advisor's name: ______", ['Marta'], 'She spells it: M-A-R-T-A.'),
      ], { maxWords: 2 }),
    ],
  }),
  mat('demo-l2-garden', 'listening', 'both', 2, 'Welcome talk at a community garden', 'You will hear a volunteer coordinator giving a short talk to visitors at a community garden.', {
    audioScript: L_P2_SCRIPT,
    transcript: L_P2_SCRIPT,
    tags: ['local area', 'environment'],
    groups: [
      g('mcq', 'Choose the correct letter, A, B or C.', [
        q('What was on the site before the garden was created?', ['B'], 'The garden was built "on the site of an old car park".', ['a primary school', 'a car park', 'a factory']),
        q('Who looks after the raised beds today?', ['C'], 'Local families, two primary schools and a care home.', ['only local families', 'paid gardeners from the council', 'families, schools and a care home']),
      ]),
      g('matching', 'Which part of the garden does each statement describe? Choose the correct letter, A–E.', [
        q('Visitors may smell but not pick the plants here.', ['B'], 'Herb spiral: "feel free to smell the plants, but… not to pick them."'),
        q('Young plants are grown here in early spring.', ['A'], 'The greenhouse is "where we grow seedlings in early spring".'),
        q('Children must be accompanied by an adult here.', ['C'], 'At the pond, children "must be supervised by an adult".'),
        q('It now uses waste from local cafés.', ['E'], 'The compost area now collects coffee grounds from three cafés.'),
        q('Visitors must write in a book when borrowing items.', ['D'], 'Tools must be signed out "in the book by the door" of the tool shed.'),
      ], { options: ['greenhouse', 'herb spiral', 'pond', 'tool shed', 'compost area'] }),
      g('completion', 'Complete the sentences. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.', [
        q('The Saturday work party finishes at ______.', ['12', 'twelve', '12.00', '12:00', 'noon', 'midday'], 'It runs "from nine until twelve".'),
        q('Volunteers are asked to wear ______.', ['sturdy shoes'], 'Gloves are provided; volunteers only need sturdy shoes.'),
        q('Money from the festival will pay for a new ______ system.', ['rainwater collection', 'rainwater'], 'The festival raised money "for a new rainwater collection system".'),
      ], { maxWords: 2 }),
    ],
  }),
  mat('demo-l3-noise', 'listening', 'both', 3, 'Student project on noise in halls of residence', 'You will hear two students, Leo and Amira, discussing their research project with their tutor.', {
    audioScript: L_P3_SCRIPT,
    transcript: L_P3_SCRIPT,
    tags: ['university', 'research'],
    groups: [
      g('mcq', 'Choose the correct letter, A, B or C.', [
        q('Why did the students use a phone app to measure noise?', ['B'], 'The physics department meters "were all booked". They checked the app against a meter, but the app was not chosen for accuracy.', ['It was more accurate than a sound meter.', 'The sound meters were not available.', 'Their tutor recommended it.']),
        q('According to Leo, Kingsley Hall is noisy mainly because of', ['B'], 'Kingsley is on a quiet street; the problem is hard floors and no carpets inside.', ['traffic on a nearby road.', 'hard surfaces inside the building.', 'the large number of residents.']),
        q('The survey showed that noise mostly affected students’', ['A'], 'Most said noise affected their sleep more than their studying.', ['sleep.', 'studying.', 'social life.']),
        q('What will the students recommend?', ['C'], 'Carpets were rejected as expensive to clean; they will suggest rubber door closers.', ['new carpets', 'quiet hours in the evenings', 'rubber door closers']),
        q('What does the tutor say about the literature review?', ['A'], 'It is "a bit thin"; they need at least two more recent studies.', ['It needs more recent studies.', 'It has too many quotations.', 'It should be shorter.']),
      ]),
      g('completion', 'Complete the sentence. Write ONE WORD AND/OR A NUMBER.', [
        q('The new deadline is the ______ of May.', ['14', '14th', 'fourteenth'], 'The deadline moved from the seventh to the fourteenth of May.'),
      ], { maxWords: 1 }),
    ],
  }),
  mat('demo-l4-bamboo', 'listening', 'both', 4, 'Lecture: bamboo as a building material', 'You will hear part of a lecture about bamboo in construction.', {
    audioScript: L_P4_SCRIPT,
    transcript: L_P4_SCRIPT,
    tags: ['engineering', 'environment'],
    groups: [
      g('completion', 'Complete the notes below. Write ONE WORD ONLY for each answer.', [
        q('Bamboo is classified as a type of ______.', ['grass'], '"Bamboo is actually a type of grass."'),
        q('A plantation can be harvested after three to five ______.', ['years'], 'Compare: timber trees take several decades.'),
        q('Its strength comes from fibres running along the ______ of the stem.', ['length'], '"The fibres run along the length of the stem."'),
        q('Bamboo may split if it is ______.', ['nailed'], 'It is weak across the fibres, so "it can split if it is nailed".'),
        q('Traditional joints use rope or wooden ______.', ['pegs'], 'Builders join bamboo "using rope or wooden pegs".'),
        q('Starch in untreated bamboo attracts ______.', ['insects', 'beetles'], 'Starch "attracts insects, particularly beetles".'),
        q('Modern treatment uses a solution of ______ salts.', ['boron'], 'Boron salts are "relatively safe for humans".'),
        q('Engineered bamboo is made by gluing and pressing ______.', ['strips'], 'Stems are cut into strips, then glued and pressed.'),
        q('______ can reduce the environmental benefits in Europe.', ['transport', 'transportation'], 'Much bamboo is grown in Asia, so transport cancels out some benefits.'),
      ], { maxWords: 1 }),
    ],
  }),
];

// ---------------------------------- READING ----------------------------------
const R_ACAD_1A = `Over the past two decades, beehives have appeared on the roofs of offices, hotels and apartment blocks in cities from London to Melbourne. Urban beekeeping is often promoted as a way to help pollinators, whose numbers have declined in many parts of the world. Companies install hives as part of their environmental programmes, and some even sell honey produced on their own buildings to customers and staff.

The reasoning seems straightforward. Cities can offer bees a surprising variety of flowers, from parks and private gardens to the plants that grow along railway lines. Because many urban gardeners use fewer pesticides than farmers, city honey is sometimes found to contain lower levels of agricultural chemicals than honey from the countryside. In addition, temperatures in cities are often slightly higher than in the surrounding area, which can extend the season in which flowers bloom.

However, a number of ecologists have begun to question whether more hives automatically mean healthier pollinator populations. The honeybee is just one of more than twenty thousand bee species worldwide, and the great majority of these are wild, solitary bees that do not live in hives or produce honey. Research in one European capital found that as the number of hives in the city rose, the amount of nectar and pollen available to each bee fell, and wild pollinators were recorded less often in areas with the most hives. The researchers concluded that honeybees may compete with wild species for limited food.

Disease is a second concern. Honeybees kept at high density can spread parasites and viruses, and some of these are also capable of infecting bumblebees and other wild species. Experienced beekeepers inspect their hives regularly, but in many cities a growing proportion of hives are managed by contractors on behalf of companies, and the quality of care is not always consistent.

None of this means that urban beekeeping should be abandoned. Instead, many conservationists argue that the most effective action is to increase the food supply rather than the number of bees. Planting a diversity of flowering species that bloom at different times of year benefits honeybees and wild bees alike. Leaving areas of lawn uncut and providing bare ground or dead wood, where many solitary bees build their nests, can also make a real difference. A city that wants to help bees, in other words, should think first about flowers and only then about hives.`;

const R_ACAD_1B = `A In 1885, the German psychologist Hermann Ebbinghaus published the results of an unusual experiment in which he was the only participant. For months he memorised lists of meaningless syllables, such as "dax" and "wib", and then tested himself at different intervals to see how much he remembered. He found that memory declines steeply in the first hours after learning and then more slowly, a pattern now known as the forgetting curve.

B Ebbinghaus also noticed something else. When he spread his study sessions over several days, he needed fewer repetitions in total to learn a list than when he crammed all the practice into a single session. This finding, called the spacing effect, has since been reproduced in hundreds of studies, with subjects ranging from vocabulary to surgical skills.

C Why should spacing help? One explanation is that each time we return to information after a gap, we have to work harder to retrieve it, and this effort strengthens the memory. When repetitions come one after another, the information is still fresh, so the brain does little work and the benefit of each repetition is reduced. Psychologists sometimes describe this as a "desirable difficulty": a type of challenge that slows learning in the short term but improves it in the long term.

D Despite the evidence, spacing is rarely used deliberately. Surveys of university students suggest that most prefer to reread their notes shortly before an exam. Part of the reason is that cramming feels effective: information that has just been reviewed seems familiar, and learners mistake this familiarity for real understanding. Spaced practice, by contrast, often feels frustrating because learners notice how much they have forgotten.

E Technology may help to change this. Flashcard applications now schedule reviews automatically, showing a card again just before the learner is likely to forget it. The interval grows each time the card is answered correctly, from a day to several days and then to weeks. For language learners preparing for an exam, a schedule like this can make a limited amount of study time go considerably further.`;

const R_ACAD_2 = `A Along rocky coastlines in cool, nutrient-rich waters, giant seaweeds known as kelp form dense underwater forests. Some species can grow up to half a metre a day and reach more than thirty metres in length, held upright by small gas-filled bladders. Although kelp looks like a plant, it belongs to a group of organisms called brown algae, and unlike trees it has no roots; instead, it attaches itself to rocks with a structure called a holdfast.

B Kelp forests support a remarkable variety of life. Fish shelter among the fronds, sea urchins and snails graze on them, and seals and sea otters hunt within them. Coastal communities have long benefited too: kelp reduces the force of waves before they reach the shore, and it has been harvested for food, fertiliser and, more recently, for thickening agents used in products such as toothpaste and ice cream.

C In recent decades, however, many kelp forests have shrunk dramatically. Off parts of northern California, more than ninety per cent of the kelp canopy disappeared after 2014. The causes were linked. A marine heatwave weakened the kelp, while a disease wiped out many of the sea stars that normally eat sea urchins. Without predators, urchin populations grew rapidly and grazed the remaining kelp down to bare rock, leaving what scientists call "urchin barrens".

D Once a barren has formed, it can be remarkably stable. Starving urchins can survive for long periods by reducing their metabolism, and they quickly consume any young kelp that begins to grow. As a result, simply waiting for water temperatures to fall again may not be enough for the forest to recover.

E Restoration projects are now testing several approaches. In some areas, divers remove urchins by hand, sometimes paying commercial fishers to collect them. Because urchins from barrens have little flesh, researchers are experimenting with feeding them in tanks for several weeks so that they can be sold as seafood, turning removal into a business. Elsewhere, scientists are growing kelp on ropes in nurseries and transplanting it to cleared reefs.

F Some researchers argue that restoration must look further ahead. They are searching for kelp populations that tolerate warmer water and breeding them for future planting, much as farmers select crops for drought resistance. Critics warn that this could reduce genetic diversity, but supporters reply that without intervention there may be little left to protect.`;

const R_ACAD_3 = `For most of the past century, governments have judged economic success mainly by one number: gross domestic product, the total value of the goods and services a country produces. GDP has obvious attractions. It is calculated in a consistent way across countries, it is published regularly, and it tends to rise when employment and incomes rise. Yet its creators never intended it to measure national well-being, and it is in this role that, in my view, it has become most misleading.

The difficulty is that GDP counts activity, not benefit. If a forest is cut down and sold as timber, GDP increases, but the loss of the forest is not recorded. Money spent repairing damage after a flood adds to GDP just as money spent building a new school does. Meanwhile, much of what makes life worthwhile, such as unpaid care for children and elderly relatives, volunteering and leisure time, does not appear in the figures at all.

In response, several governments have begun to publish well-being dashboards alongside GDP. These include indicators such as life expectancy, levels of education, air quality and people's own ratings of their life satisfaction. New Zealand went further in 2019, requiring government departments to show how proposed spending would affect well-being. Supporters claim these approaches put people, rather than production, at the centre of policy.

I am sympathetic to this argument, but I think it is too early to judge whether dashboards change decisions in practice. A collection of forty indicators is harder to communicate than a single figure, and politicians may simply highlight the measures that make them look good. There is also a genuine question about self-reported happiness. People adapt to their circumstances, so a population may report reasonable satisfaction even when conditions are poor, and cultural differences affect how people answer survey questions.

None of this is an argument for keeping GDP as the only measure of progress. Rather, the lesson is that no single number can capture everything a society values. The most useful approach is probably a small set of indicators, chosen through public debate, that are reported as prominently as GDP is today. If the measures we pay attention to shape the decisions we make, then choosing them carefully may be one of the most important economic choices a country faces.`;

const R_GT_1 = `Greenfield Public Library: Information for New Members

Borrowing
Members may borrow up to twelve items at a time, including books, audiobooks and DVDs. Books can be kept for three weeks; DVDs must be returned within seven days. Items can be renewed twice, online or by phone, unless another member has reserved them.

Late returns
There is no charge for late books borrowed by children under sixteen. For adult members, a charge of 20p per day applies to each overdue book, up to a maximum of £5 per item. DVDs returned late are charged at £1 per day.

Computers and printing
Members can book a computer for up to two hours per day. Bookings can be made at the front desk or through the library website. Black-and-white printing is available on every floor; colour printing is available only on the first floor.

Study rooms
Three quiet study rooms on the second floor can be reserved free of charge by groups of two to six people. Food is not allowed in the study rooms, but drinks in sealed containers are permitted.

Events
The library runs a free Saturday story time for children aged three to six, and an English conversation club for adults on Wednesday evenings. Places at the conversation club are limited to fifteen, so please register in advance at the front desk.`;

const R_GT_2 = `Coastline Hotels: Your First Week

Uniform
You will receive two sets of uniform on your first day. Uniforms are cleaned free of charge by our laundry service: leave them in the labelled bags in the staff changing room by 8 p.m. and they will be ready the following afternoon. Staff are responsible for providing their own black, non-slip shoes.

Shifts and breaks
Rotas are published every Thursday for the following week and can be viewed on the staff app. If you wish to swap a shift with a colleague, both of you must confirm the change with your supervisor at least 48 hours in advance. Staff working a shift of six hours or more are entitled to a 30-minute paid break and a free meal in the staff canteen.

Sickness
If you are unwell and unable to work, telephone the duty manager no later than two hours before your shift begins. Text messages and emails are not accepted. For absences of more than three days, a doctor's note is required.

Training
All new employees complete a fire safety session during their first week. Food-handling staff must also obtain a food hygiene certificate within their first month; the course is online and the hotel pays the fee. After six months, staff can apply for the Coastline Development Programme, which offers training in supervision and customer service.`;

const R_GT_3 = `A On the first Saturday of every month, a community hall in a small Dutch town fills with broken objects: toasters that no longer toast, lamps with frayed cables, trousers with torn seams. Their owners have come to a repair café, where volunteers with practical skills help them fix their belongings for free. The idea was launched in Amsterdam in 2009, and there are now thousands of repair cafés around the world.

B The motivation is partly environmental. Electronic waste is one of the fastest-growing types of rubbish, and many items are thrown away because of a minor fault that could be fixed in minutes. Organisers point out that repairing a product usually requires far less energy and raw material than manufacturing a new one.

C But volunteers say the social side is just as important. Visitors are expected to stay with the volunteer while the repair takes place, rather than leaving the item and collecting it later. In this way, they learn how their possessions work and often gain the confidence to attempt simple repairs at home. Many cafés also serve tea and cake, and for some older visitors the monthly event is an important chance to meet people.

D Repair cafés have encountered obstacles. Some products are designed in ways that make repair difficult: parts are glued rather than screwed together, and spare parts or repair manuals may be unavailable. Volunteers also worry about safety, particularly with appliances that use high voltage, and most cafés have rules about which items they will accept.

E There are signs, however, that the movement is influencing policy. Several countries have introduced "right to repair" laws, which require manufacturers of certain appliances to make spare parts available for a number of years after a product is sold. Campaigners hope that, in future, how easily a product can be repaired will matter as much to shoppers as its price or appearance.`;

const READING: Material[] = [
  mat('demo-ra1-bees', 'reading', 'academic', 1, 'Rooftop beekeeping and the limits of good intentions', 'You should spend about 20 minutes on the questions based on this passage.', {
    passage: R_ACAD_1A,
    tags: ['environment', 'cities'],
    groups: [
      g('tfng', 'Do the following statements agree with the information given in the passage? Choose TRUE if the statement agrees with the information, FALSE if the statement contradicts the information, or NOT GIVEN if there is no information on this.', [
        q('Some companies sell honey produced on their own buildings.', ['TRUE'], 'Paragraph 1: some "sell honey produced on their own buildings".'),
        q('Honey from cities always contains fewer chemicals than honey from the countryside.', ['FALSE'], 'Paragraph 2 says this is "sometimes" found, not always.'),
        q('Warmer temperatures in cities can lengthen the flowering season.', ['TRUE'], 'Paragraph 2: higher temperatures "can extend the season in which flowers bloom".'),
        q('Most bee species live in hives.', ['FALSE'], 'Paragraph 3: the great majority are solitary bees "that do not live in hives".'),
        q('The research in the European capital was funded by a beekeeping association.', ['NOT GIVEN'], 'The passage does not say who funded the research.'),
        q('All urban hives are managed by contractors.', ['FALSE'], 'Paragraph 4: "a growing proportion", not all.'),
      ]),
      g('completion', 'Complete the sentences. Choose ONE WORD ONLY from the passage for each answer.', [
        q('Some honeybee diseases can also infect ______ and other wild species.', ['bumblebees'], 'Paragraph 4.'),
        q('Conservationists believe the priority should be to increase the ______ supply.', ['food'], 'Paragraph 5: "increase the food supply rather than the number of bees".'),
        q('Many solitary bees build their nests in bare ground or dead ______.', ['wood'], 'Paragraph 5.'),
      ], { maxWords: 1 }),
      g('mcq', 'Choose the correct letter, A, B, C or D.', [
        q("What is the writer's main purpose in the passage?", ['B'], 'The writer accepts some benefits but questions whether more hives help pollinators, and ends with a recommendation about flowers.', [
          'to argue that urban beekeeping should be stopped',
          'to suggest that the benefits of urban hives may be overstated',
          'to explain how to set up a hive on a roof',
          'to compare the quality of city and country honey',
        ]),
      ]),
    ],
  }),
  mat('demo-ra1-memory', 'reading', 'academic', 1, 'The spacing effect', 'You should spend about 20 minutes on the questions based on this passage.', {
    passage: R_ACAD_1B,
    tags: ['psychology', 'education'],
    groups: [
      g('matching', 'The passage has five paragraphs, A–E. Which paragraph contains the following information? Choose the correct letter, A–E.', [
        q('a reason why learners choose a less effective way of studying', ['D'], 'Paragraph D: cramming "feels effective" because of familiarity.'),
        q('a description of an experiment with only one participant', ['A'], 'Ebbinghaus "was the only participant".'),
        q('a name for a challenge that helps learning in the long run', ['C'], '"Desirable difficulty" in paragraph C.'),
        q('an example of review intervals becoming longer over time', ['E'], 'From a day, to several days, to weeks.'),
      ], { options: ['Paragraph A', 'Paragraph B', 'Paragraph C', 'Paragraph D', 'Paragraph E'] }),
      g('completion', 'Complete the sentences. Choose NO MORE THAN TWO WORDS from the passage for each answer.', [
        q('The pattern of memory loss after learning is known as the ______.', ['forgetting curve'], 'Paragraph A.'),
        q('With spaced sessions, Ebbinghaus needed fewer ______ in total.', ['repetitions'], 'Paragraph B: "fewer repetitions in total".'),
        q('Learners mistake familiarity for real ______.', ['understanding'], 'Paragraph D.'),
      ], { maxWords: 2 }),
      g('mcq', 'Choose the correct letter, A, B, C or D.', [
        q('According to paragraph C, spaced practice is effective because', ['B'], 'Returning after a gap means "we have to work harder to retrieve it".', [
          'information is presented more clearly.',
          'recalling information requires more effort.',
          'learners feel more confident.',
          'study sessions are shorter.',
        ]),
      ]),
    ],
  }),
  mat('demo-ra2-kelp', 'reading', 'academic', 2, 'Underwater forests', 'You should spend about 20 minutes on the questions based on this passage.', {
    passage: R_ACAD_2,
    tags: ['marine science', 'environment'],
    groups: [
      g('matching', 'The passage has six paragraphs, A–F. Choose the correct heading for each paragraph from the list of headings.', [
        q('Paragraph A', ['E'], 'Paragraph A explains what kelp is (brown algae, holdfast) and how fast it grows.'),
        q('Paragraph B', ['C'], 'Fish, otters and coastal communities all benefit.'),
        q('Paragraph C', ['F'], 'A heatwave and sea-star disease led to an urchin explosion: linked causes.'),
        q('Paragraph D', ['A'], 'Barrens are stable because starving urchins eat any new kelp.'),
        q('Paragraph E', ['B'], 'Urchins are fattened in tanks and sold as seafood.'),
        q('Paragraph F', ['D'], 'Breeding heat-tolerant kelp for future planting.'),
      ], {
        options: [
          'A self-reinforcing problem',
          'Turning a pest into a product',
          'Benefits for wildlife and people',
          'Breeding for a hotter future',
          'What kelp is and how it grows',
          'A chain of events leads to collapse',
          'The global market for seaweed',
          'Why sea otters are disappearing',
        ],
      }),
      g('tfng', 'Do the following statements agree with the information given in the passage? Choose TRUE, FALSE or NOT GIVEN.', [
        q('Kelp is a type of plant.', ['FALSE'], 'It "looks like a plant" but belongs to the brown algae.'),
        q('Substances from kelp are used in some ice cream.', ['TRUE'], 'Paragraph B mentions thickening agents in toothpaste and ice cream.'),
        q('Sea otter numbers fell in northern California after 2014.', ['NOT GIVEN'], 'The passage mentions sea stars, not sea otter numbers.'),
        q('Urchin barrens usually recover quickly once the water cools.', ['FALSE'], 'Paragraph D: waiting for cooler water "may not be enough".'),
      ]),
      g('completion', 'Complete the sentences. Choose ONE WORD ONLY from the passage for each answer.', [
        q('Kelp is fixed to rocks by a ______.', ['holdfast'], 'Paragraph A.'),
        q('Starving urchins survive by reducing their ______.', ['metabolism'], 'Paragraph D.'),
      ], { maxWords: 1 }),
    ],
  }),
  mat('demo-ra3-gdp', 'reading', 'academic', 3, 'Beyond GDP', 'You should spend about 20 minutes on the questions based on this passage.', {
    passage: R_ACAD_3,
    tags: ['economics', 'opinion'],
    groups: [
      g('ynng', "Do the following statements agree with the views of the writer? Choose YES if the statement agrees with the views of the writer, NO if the statement contradicts the views of the writer, or NOT GIVEN if it is impossible to say what the writer thinks about this.", [
        q('GDP was originally designed to measure national well-being.', ['NO'], 'Its creators "never intended it to measure national well-being".'),
        q('GDP is most misleading when it is used as a measure of well-being.', ['YES'], '"It is in this role that, in my view, it has become most misleading."'),
        q('Spending on disaster repairs should be removed from GDP calculations.', ['NOT GIVEN'], 'The writer gives this as an example of a weakness but does not say it should be removed.'),
        q('Well-being dashboards have clearly improved government decisions.', ['NO'], '"It is too early to judge whether dashboards change decisions in practice."'),
        q('Cultural factors can influence answers to happiness surveys.', ['YES'], '"Cultural differences affect how people answer survey questions."'),
      ]),
      g('mcq', 'Choose the correct letter, A, B, C or D.', [
        q('What does the writer say about New Zealand?', ['B'], 'Departments had to "show how proposed spending would affect well-being".', [
          'It stopped publishing GDP figures.',
          'It required departments to consider the well-being effects of spending.',
          'Its citizens report the highest life satisfaction.',
          'It publishes forty different indicators.',
        ]),
        q("What is the writer's conclusion?", ['C'], 'Final paragraph: "a small set of indicators, chosen through public debate… reported as prominently as GDP".', [
          'GDP should be replaced by happiness surveys.',
          'Well-being dashboards are too complicated to be useful.',
          'A few publicly chosen measures should be given the same prominence as GDP.',
          'Economic growth no longer matters.',
        ]),
      ]),
      g('completion', 'Complete the sentences. Choose ONE WORD ONLY from the passage for each answer.', [
        q('Unpaid ______ for children and elderly relatives is not counted in GDP.', ['care'], 'Paragraph 2.'),
        q('Because people ______ to their circumstances, satisfaction can stay high when conditions are poor.', ['adapt'], 'Paragraph 4.'),
      ], { maxWords: 1 }),
    ],
  }),
  mat('demo-rg1-library', 'reading', 'general', 1, 'Information for new library members', 'Read the text and answer the questions.', {
    passage: R_GT_1,
    tags: ['everyday', 'notices'],
    groups: [
      g('tfng', 'Do the following statements agree with the information given in the text? Choose TRUE, FALSE or NOT GIVEN.', [
        q('Members can borrow a maximum of twelve items at once.', ['TRUE'], '"Up to twelve items at a time".'),
        q('DVDs can be kept for three weeks.', ['FALSE'], 'DVDs must be returned within seven days; books are three weeks.'),
        q('Children under sixteen do not pay for late books.', ['TRUE'], '"No charge for late books borrowed by children under sixteen."'),
        q('Colour printing costs more than black-and-white printing.', ['NOT GIVEN'], 'No printing prices are given.'),
        q('A single person can book a study room.', ['FALSE'], 'Rooms are for groups of two to six people.'),
      ]),
      g('completion', 'Complete the sentences. Write ONE WORD AND/OR A NUMBER for each answer.', [
        q('Items cannot be renewed if another member has ______ them.', ['reserved'], 'Borrowing section.'),
        q('Drinks are allowed in study rooms if they are in ______ containers.', ['sealed'], 'Study rooms section.'),
        q('The conversation club meets on ______ evenings.', ['Wednesday', 'Wednesdays'], 'Events section.'),
      ], { maxWords: 2 }),
    ],
  }),
  mat('demo-rg2-hotel', 'reading', 'general', 2, 'Staff handbook: your first week', 'Read the text and answer the questions.', {
    passage: R_GT_2,
    tags: ['workplace'],
    groups: [
      g('mcq', 'Choose the correct letter, A, B or C.', [
        q('A uniform is left for cleaning at 7 p.m. When will it be ready?', ['C'], 'Left by 8 p.m., ready "the following afternoon".', ['later the same evening', 'the next morning', 'the next afternoon']),
        q('What must staff do to swap a shift?', ['B'], 'Both employees must confirm with the supervisor at least 48 hours in advance.', [
          'post the change on the staff app',
          'both confirm it with a supervisor two days beforehand',
          'get approval from the duty manager the same day',
        ]),
        q('How should staff report that they are sick?', ['C'], '"Telephone the duty manager"; texts and emails are not accepted.', ['by text message', 'by email', 'by phone']),
      ]),
      g('completion', 'Complete the sentences. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.', [
        q('Staff must provide their own black, ______ shoes.', ['non-slip', 'non slip'], 'Uniform section.'),
        q('A free meal is given for shifts of at least ______ hours.', ['6', 'six'], 'Shifts and breaks section.'),
        q('For absences of more than three days, a ______ is required.', ["doctor's note", 'doctors note', 'doctor note'], 'Sickness section.'),
        q('The food hygiene course is taken ______.', ['online'], 'Training section.'),
        q('Staff can apply for the Development Programme after ______ months.', ['6', 'six'], 'Training section.'),
      ], { maxWords: 2 }),
    ],
  }),
  mat('demo-rg3-repair', 'reading', 'general', 3, 'The rise of the repair café', 'Read the passage and answer the questions.', {
    passage: R_GT_3,
    tags: ['society', 'environment'],
    groups: [
      g('matching', 'The passage has five paragraphs, A–E. Choose the correct heading for each paragraph from the list.', [
        q('Paragraph A', ['F'], 'Describes a monthly event in a Dutch town.'),
        q('Paragraph B', ['D'], 'Repair uses less energy and raw material.'),
        q('Paragraph C', ['B'], 'Visitors stay and learn how their possessions work.'),
        q('Paragraph D', ['E'], 'Glued parts, missing spare parts and safety concerns.'),
        q('Paragraph E', ['A'], '"Right to repair" laws.'),
      ], {
        options: ['A movement that is changing the law', 'Learning while things are fixed', 'How the idea spread to other countries', 'Saving resources', 'Barriers to repair', 'A typical event', 'Training new volunteers'],
      }),
      g('tfng', 'Do the following statements agree with the information given in the passage? Choose TRUE, FALSE or NOT GIVEN.', [
        q('The first repair café was set up in Amsterdam.', ['TRUE'], 'Paragraph A: "launched in Amsterdam in 2009".'),
        q('Visitors usually collect their repaired items the following week.', ['FALSE'], 'Visitors stay while the repair takes place.'),
        q('Most volunteers are retired engineers.', ['NOT GIVEN'], 'Volunteers are described only as having practical skills.'),
        q('Some repair cafés refuse to accept certain items.', ['TRUE'], 'Most have "rules about which items they will accept".'),
      ]),
    ],
  }),
];

// ---------------------------------- WRITING ----------------------------------
const WRITING: Material[] = [
  mat('demo-wa1-leisure', 'writing', 'academic', 1, 'Leisure time in 2000 and 2020 (bar chart)', 'You should spend about 20 minutes on this task. Write at least 150 words.', {
    prompt: 'The bar chart below shows the average number of hours per week that people in one country spent on four leisure activities in 2000 and 2020.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.',
    imageUrl: barChart(),
    imageAlt: 'Bar chart. Hours per week in 2000 and 2020: watching TV 15 and 9; online video 2 and 14; reading 6 and 4; sport and exercise 3 and 5.',
    minWords: 150,
    tags: ['bar chart', 'change over time'],
    scoringGuidance: 'A strong answer gives a clear overview in the introduction or conclusion: online video rose sharply to become the most popular activity, overtaking television, which fell. It groups the smaller changes (reading fell slightly, sport rose slightly) and supports each with accurate figures. It does not speculate about causes, because the task asks only for a description.',
    modelAnswer: `The bar chart compares how many hours a week people in one country devoted to four leisure activities in 2000 and in 2020.

Overall, the most striking change was the rise of online video, which went from being the least popular activity to the most popular one. Television viewing, by contrast, fell considerably, while the figures for reading and sport changed only slightly.

In 2000, watching television was by far the dominant pastime, at 15 hours per week, compared with just 2 hours for online video. Twenty years later, the positions had been reversed: time spent on online video had increased seven-fold to 14 hours, whereas television viewing had dropped by 6 hours to 9.

The two remaining activities accounted for much less time in both years. Reading declined modestly from 6 hours to 4, so that by 2020 it was the least time-consuming activity shown. Sport and exercise moved in the opposite direction, rising from 3 hours to 5, although it still occupied far less time than either form of screen entertainment.`,
  }),
  mat('demo-wa1-museums', 'writing', 'academic', 1, 'Museum visitors 2015–2025 (line graph)', 'You should spend about 20 minutes on this task. Write at least 150 words.', {
    prompt: 'The graph below shows the number of visitors to three museums in one city between 2015 and 2025.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.',
    imageUrl: lineChart(),
    imageAlt: 'Line graph of visitors in thousands, 2015 to 2025. Science museum: 420, 450, 480, 260, 430, 510. Art gallery: 300, 310, 330, 150, 340, 390. History museum: 510, 490, 470, 220, 380, 400. All three fell sharply in 2021.',
    minWords: 150,
    tags: ['line graph', 'trends'],
    scoringGuidance: 'Key features: all three museums saw a sharp fall in 2021 followed by recovery; the science museum ended as the most visited (510k), overtaking the history museum, which began as the most popular but never regained its 2015 level. Good answers group the data by trend rather than describing each year mechanically.',
  }),
  mat('demo-wg1-kitchen', 'writing', 'general', 1, 'Letter: a faulty kitchen appliance', 'You should spend about 20 minutes on this task. Write at least 150 words. You do NOT need to write any addresses. Begin your letter as follows: Dear Sir or Madam,', {
    prompt: 'You recently bought a piece of equipment for your kitchen, but it did not work properly. You returned it to the shop, but the problem was not solved.\n\nWrite a letter to the shop manager. In your letter:',
    bullets: ['describe the problem with the equipment', 'explain what happened when you returned it to the shop', 'say what you would like the manager to do'],
    minWords: 150,
    tags: ['letter', 'formal', 'complaint'],
    scoringGuidance: 'Formal tone throughout (Dear Sir or Madam / Yours faithfully). All three bullet points must be covered and developed with specific details (product, date, fault). The purpose (complaint and request for refund or replacement) should be clear from the first paragraph.',
    modelAnswer: `Dear Sir or Madam,

I am writing to complain about a food processor I bought from your Market Street branch on 3 March, and about the way my attempt to return it was handled.

The machine worked for only a few days. On the fourth use, the motor began to make a loud grinding noise and then stopped completely, even though I had followed the instructions carefully and had not overloaded the bowl.

When I took it back to the shop the following week, the assistant refused to give me a refund. She claimed that the fault had probably been caused by misuse and offered only to send the machine away for repair, which she said could take up to six weeks. As I had kept the receipt and the original packaging, I found this response extremely disappointing.

I would therefore be grateful if you could arrange either a full refund of £89 or an immediate replacement. I have enclosed a copy of my receipt and would appreciate a reply within ten working days.

Yours faithfully,
Lan Nguyen`,
  }),
  mat('demo-wg1-visit', 'writing', 'general', 1, 'Letter: a friend is coming to stay', 'You should spend about 20 minutes on this task. Write at least 150 words. You do NOT need to write any addresses. Begin your letter as follows: Dear …,', {
    prompt: 'A friend from another country is coming to stay with you in your city for a week.\n\nWrite a letter to your friend. In your letter:',
    bullets: ['suggest some places you could visit together', 'explain how to travel from the airport to your home', 'tell your friend what they should bring'],
    minWords: 150,
    tags: ['letter', 'informal'],
    scoringGuidance: 'Informal, friendly tone (Dear Sam / Best wishes). Each bullet point should be expanded with reasons or details, e.g. why a place is worth visiting, clear travel steps, and why particular items are needed (weather, activities).',
  }),
  mat('demo-w2-universities', 'writing', 'both', 2, 'Essay: the purpose of university', 'You should spend about 40 minutes on this task. Write at least 250 words.', {
    prompt: 'Some people believe that universities should focus on giving students the practical skills they need for employment. Others think that higher education has broader purposes.\n\nDiscuss both these views and give your own opinion.\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.',
    minWords: 250,
    tags: ['education', 'discuss both views'],
    scoringGuidance: 'Both views must be discussed with developed reasons, and the writer’s own opinion must be stated clearly (ideally in the introduction and conclusion). Typical ideas: employability and student debt vs. critical thinking, research and citizenship. Paragraphs should each have a clear central idea.',
    modelAnswer: `Whether universities should concentrate on preparing students for work or pursue wider educational aims is a long-standing debate. In my view, the two goals are not opposites, but a university education that is narrowly vocational would fail both students and society.

Those who favour a practical focus point to the cost of higher education. Many students now graduate with significant debts, and it seems reasonable for them to expect a degree to improve their job prospects. Employers, too, frequently complain that graduates lack basic workplace skills such as teamwork, project management and familiarity with industry software. From this perspective, courses that include internships or applied projects offer better value for both students and the economy.

On the other hand, universities have traditionally served purposes that go beyond employment. They are centres of research, where knowledge is created rather than simply passed on, and they train people to question assumptions, weigh evidence and express complex ideas clearly. These abilities are difficult to measure but valuable in almost every profession. Moreover, the labour market changes quickly; a student trained only in today’s software may find those skills outdated within a decade, whereas the capacity to learn independently lasts a lifetime.

On balance, I believe the best universities combine both approaches. A history graduate who has also completed a work placement, or an engineering student who has studied ethics, is better prepared for a career and for civic life than one whose education was limited to either theory or training. Universities should therefore build practical experience into their courses without abandoning their broader mission.`,
  }),
  mat('demo-w2-livingalone', 'writing', 'both', 2, 'Essay: people living alone', 'You should spend about 40 minutes on this task. Write at least 250 words.', {
    prompt: 'In many countries, the number of people who live alone is increasing.\n\nWhat are the reasons for this? Is this a positive or negative development?\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.',
    minWords: 250,
    tags: ['society', 'two-part question'],
    scoringGuidance: 'Both questions must be answered: reasons (e.g. later marriage, ageing populations, financial independence, urban jobs) and a clear evaluation of whether the trend is positive or negative. A balanced answer can still reach a clear position.',
  }),
  mat('demo-w2-transport', 'writing', 'both', 2, 'Essay: public transport or roads?', 'You should spend about 40 minutes on this task. Write at least 250 words.', {
    prompt: 'Some people say that governments should spend money on improving public transport rather than on building new roads.\n\nTo what extent do you agree or disagree?\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.',
    minWords: 250,
    tags: ['transport', 'opinion'],
    scoringGuidance: 'The extent of agreement should be clear and consistent. Strong answers consider congestion, the environment, cost and access for rural areas, and support each point with an explanation or example rather than a list of ideas.',
  }),
];

// ---------------------------------- SPEAKING ----------------------------------
const SPEAKING: Material[] = [
  mat('demo-s1-home', 'speaking', 'both', 1, 'Part 1: home and hometown', 'The examiner asks you some questions about yourself. Answer each question in two to four sentences.', {
    speakingQuestions: [
      'Do you live in a house or an apartment?',
      'What do you like most about your home?',
      'Is there anything you would like to change about where you live?',
      'What is your hometown best known for?',
      'Do you think your hometown is a good place for young people? Why?',
    ],
    responseSeconds: 30,
    tags: ['home', 'familiar topics'],
    scoringGuidance: 'Answers should be extended with a reason or example rather than one word, but not memorised speeches. Listen for natural linking (actually, the thing is, mainly because).',
  }),
  mat('demo-s1-routine', 'speaking', 'both', 1, 'Part 1: daily routine and music', 'The examiner asks you some questions about yourself. Answer each question in two to four sentences.', {
    speakingQuestions: [
      'What do you usually do in the mornings?',
      'Has your daily routine changed in the last few years?',
      'What kind of music do you enjoy listening to?',
      'Did you learn to play a musical instrument as a child?',
      'Do you prefer listening to music alone or with other people?',
    ],
    responseSeconds: 30,
    tags: ['routine', 'music', 'familiar topics'],
  }),
  mat('demo-s2-skill', 'speaking', 'both', 2, 'Part 2: a skill you are proud of', 'You will have one minute to prepare. You can make notes. Then talk for one to two minutes.', {
    prompt: 'Describe a skill you learned that you are proud of.',
    bullets: ['what the skill is', 'when and how you learned it', 'how difficult it was to learn', 'and explain why you are proud of it'],
    prepSeconds: 60,
    responseSeconds: 120,
    tags: ['topic:skills'],
    scoringGuidance: 'Aim to cover every point and keep talking until the two minutes end. A clear structure (background → learning process → difficulty → why it matters) helps fluency.',
  }),
  mat('demo-s2-help', 'speaking', 'both', 2, 'Part 2: a time you helped someone', 'You will have one minute to prepare. You can make notes. Then talk for one to two minutes.', {
    prompt: 'Describe a time when you helped someone.',
    bullets: ['who you helped', 'what the situation was', 'how you helped them', 'and explain how you felt about it'],
    prepSeconds: 60,
    responseSeconds: 120,
    tags: ['topic:helping'],
  }),
  mat('demo-s3-skill', 'speaking', 'both', 3, 'Part 3: skills and learning', 'The examiner asks you more general questions linked to the Part 2 topic. Give developed answers with reasons and examples.', {
    speakingQuestions: [
      'Which skills do you think are most important for young people today?',
      'Should schools teach practical skills such as cooking or managing money? Why?',
      'Is it better to learn a skill from a teacher or from online videos?',
      'How might the skills people need for work change in the next twenty years?',
    ],
    responseSeconds: 60,
    tags: ['topic:skills'],
    scoringGuidance: 'Part 3 rewards abstract discussion: comparing, speculating and justifying opinions. Look for language of speculation (it is likely that, I would imagine) and balanced views.',
  }),
  mat('demo-s3-help', 'speaking', 'both', 3, 'Part 3: helping others and community', 'The examiner asks you more general questions linked to the Part 2 topic. Give developed answers with reasons and examples.', {
    speakingQuestions: [
      'Why do some people enjoy doing volunteer work?',
      'Do you think people help their neighbours less than they did in the past?',
      'Should companies give employees time off to do charity work?',
      'Who should be responsible for helping elderly people: families or the government?',
    ],
    responseSeconds: 60,
    tags: ['topic:helping'],
  }),
];

export const DEMO_MATERIALS: Material[] = [...LISTENING, ...READING, ...WRITING, ...SPEAKING, ...MORE_MATERIALS];
