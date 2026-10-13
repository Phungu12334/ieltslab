// Second original practice set written for IELTSLab, following public IELTS task formats.
// Not official IELTS material. Every item is marked demo: true.
import { esc, g, mat, q, svgData } from './contentKit';
import type { Material } from './types';

// ---------------------------------- charts ----------------------------------
function pieCharts(): string {
  const cats = ['Heating', 'Hot water', 'Cooking', 'Lighting', 'Appliances & electronics'];
  const colors = ['#1b4f8a', '#5f86b8', '#b26b00', '#e0b350', '#1e7a46'];
  const years: [string, number[]][] = [
    ['1990', [58, 22, 7, 8, 5]],
    ['2020', [47, 18, 5, 3, 27]],
  ];
  const W = 680, H = 400, r = 105;
  let out = '';
  years.forEach(([label, vals], yi) => {
    const cx = 170 + yi * 340, cy = 175;
    let a0 = -Math.PI / 2;
    vals.forEach((v, i) => {
      const a1 = a0 + (v / 100) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      out += `<path d="M${cx},${cy} L${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z" fill="${colors[i]}" stroke="#ffffff" stroke-width="2"/>`;
      const mid = (a0 + a1) / 2;
      const lr = v < 6 ? r + 16 : r * 0.62;
      const lx = cx + lr * Math.cos(mid), ly = cy + lr * Math.sin(mid) + 4;
      out += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="12" font-weight="bold" text-anchor="middle" fill="${v < 6 ? '#14202e' : '#ffffff'}">${v}%</text>`;
      a0 = a1;
    });
    out += `<text x="${cx}" y="${cy + r + 34}" font-size="15" font-weight="bold" text-anchor="middle" fill="#14202e">${label}</text>`;
  });
  cats.forEach((c, i) => {
    const x = 40 + (i % 3) * 210, y = H - 34 + Math.floor(i / 3) * 20;
    out += `<rect x="${x}" y="${y - 10}" width="12" height="12" fill="${colors[i]}"/><text x="${x + 18}" y="${y}" font-size="12" fill="#14202e">${esc(c)}</text>`;
  });
  return svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H + 12}" font-family="Arial, Helvetica, sans-serif"><rect width="${W}" height="${H + 12}" fill="#ffffff"/>
<text x="${W / 2}" y="26" font-size="15" font-weight="bold" text-anchor="middle" fill="#14202e">Household energy use by purpose, Country Y</text>${out}</svg>`);
}

function processDiagram(): string {
  const steps = [
    'Rain falls on roof',
    'Gutters and downpipe',
    'Leaf filter',
    'First-flush diverter (discards first, dirtiest water)',
    'Underground storage tank',
    'Pump',
  ];
  const W = 700, H = 360, bw = 190, bh = 70;
  const pos = [
    [30, 60], [255, 60], [480, 60],
    [480, 200], [255, 200], [30, 200],
  ];
  let out = '';
  steps.forEach((s, i) => {
    const [x, y] = pos[i];
    out += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="10" fill="#e8eef6" stroke="#1b4f8a" stroke-width="1.5"/>`;
    out += `<circle cx="${x + 16}" cy="${y + 16}" r="11" fill="#1b4f8a"/><text x="${x + 16}" y="${y + 20}" font-size="12" font-weight="bold" text-anchor="middle" fill="#ffffff">${i + 1}</text>`;
    const words = s.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      if ((line + ' ' + w).trim().length > 22) {
        lines.push(line.trim());
        line = w;
      } else line += ' ' + w;
    }
    lines.push(line.trim());
    lines.forEach((l, li) => {
      out += `<text x="${x + bw / 2 + 8}" y="${y + bh / 2 + 5 + (li - (lines.length - 1) / 2) * 15}" font-size="13" text-anchor="middle" fill="#14202e">${esc(l)}</text>`;
    });
  });
  const arrow = (x1: number, y1: number, x2: number, y2: number) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#14202e" stroke-width="2" marker-end="url(#a)"/>`;
  out += arrow(220, 95, 252, 95) + arrow(445, 95, 477, 95) + arrow(575, 130, 575, 197) + arrow(480, 235, 448, 235) + arrow(255, 235, 223, 235);
  out += arrow(125, 270, 90, 318) + arrow(125, 270, 200, 318);
  out += `<rect x="20" y="320" width="150" height="30" rx="6" fill="#e3f4ea" stroke="#1e7a46"/><text x="95" y="340" font-size="12" text-anchor="middle" fill="#14202e">Toilets, washing machine</text>`;
  out += `<rect x="180" y="320" width="110" height="30" rx="6" fill="#e3f4ea" stroke="#1e7a46"/><text x="235" y="340" font-size="12" text-anchor="middle" fill="#14202e">Garden</text>`;
  out += `<text x="575" y="320" font-size="12" text-anchor="middle" fill="#3d4a5a">Overflow pipe from tank</text><text x="575" y="336" font-size="12" text-anchor="middle" fill="#3d4a5a">leads to soakaway</text>`;
  return svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif"><defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#14202e"/></marker></defs><rect width="${W}" height="${H}" fill="#ffffff"/>
<text x="${W / 2}" y="30" font-size="15" font-weight="bold" text-anchor="middle" fill="#14202e">How rainwater is collected for use in a house</text>${out}</svg>`);
}

// ---------------------------------- LISTENING ----------------------------------
const L2_FESTIVAL = `PRESENTER: Good morning, and here's what's coming up at this year's Riverside Summer Festival, which runs from Friday the twelfth to Sunday the fourteenth of July. This year the festival has moved from the town square to Elmwood Park, mainly because the square is being repaved, although the park also gives us far more space for stalls.
PRESENTER: Entry to the park is free all weekend, but some events need tickets. You can buy these online or at the information tent near the main gate, which opens at ten each morning. Please note that this year we can only accept card payments.
PRESENTER: Let me run through the highlights. The opening concert, featuring the city youth orchestra, takes place on Friday evening at seven. On Saturday morning there's a children's kite-making workshop. It's always popular, so book early, as places are limited to thirty. Saturday afternoon sees the food fair, with more than forty local producers. And on Sunday, don't miss the dragon boat race on the river, which starts at two o'clock. The race was originally planned for Saturday, but it has been moved to Sunday because of the tides.
PRESENTER: Also on Friday, there's a guided history walk leaving from the park café at four. The walk lasts ninety minutes and costs five pounds, with all the money going to the local hospice.
PRESENTER: Finally, getting there. Parking near the park is very limited, so we're asking visitors to use the free shuttle bus from the railway station, which runs every fifteen minutes. If you're cycling, there'll be secure bike parking by the north entrance.`;

const L3_CANTEEN = `MAYA: So, Tom, have you looked at the canteen data the catering manager sent us?
TOM: I have. It's quite surprising, actually. I thought most of the waste would come from main courses, but it's bread rolls. Almost half of the rolls put out each day end up in the bin.
MAYA: Really? I'd have guessed vegetables.
TOM: Vegetables are second. Anyway, I think the rolls should be the focus of our presentation.
MAYA: I agree. Now, for our own survey, should we do it online or in person?
TOM: Online would be easier to analyse.
MAYA: Yes, but the response rate for online surveys here is terrible. Last term's sustainability survey only got about forty replies. If we stand at the canteen exit with tablets, we'll catch people right after they've eaten.
TOM: Good point. Let's do that. How many questions?
MAYA: No more than eight. People won't stop for longer than a couple of minutes.
TOM: Fine. And what about timing? Lunch is the busiest.
MAYA: Lunch on Tuesday and Thursday, then. Friday's no good, because half the students go home early.
TOM: Right. Dr Hughes said she wanted the presentation to include a recommendation.
MAYA: What do you think of offering rolls only on request?
TOM: That might annoy people. What about smaller portions with free refills? Another university tried that and cut its food waste by a third.
MAYA: Oh, that's convincing. Let's go with that, and use their figures as evidence.
TOM: And who's doing the slides?
MAYA: I'll do them if you write the script. I'm better with design software.
TOM: Deal. We should rehearse at least twice before the twentieth.`;

const L4_HEAT = `LECTURER: Good afternoon. Today's topic is the urban heat island: the observation that cities are often several degrees warmer than the countryside around them. The effect is usually strongest at night. On a still summer evening, a large city can be as much as eight degrees warmer than nearby farmland.
LECTURER: There are three main causes. The first is the materials we build with. Asphalt and concrete absorb heat during the day and release it slowly after sunset. The second is the lack of vegetation. Plants cool their surroundings by releasing water vapour, a process known as evapotranspiration, and cities have replaced much of this greenery with hard surfaces. The third cause is waste heat from human activity: air-conditioning units, vehicles and industry all add heat to the urban air.
LECTURER: The consequences are significant. Higher night-time temperatures make heatwaves more dangerous, especially for elderly people, because the body has no chance to recover overnight. Energy use also rises, as more air-conditioning is needed, which in turn produces more waste heat. It is a vicious circle.
LECTURER: So what can be done? One of the simplest measures is the cool roof. By painting roofs white or using reflective materials, buildings absorb less of the sun's energy. Studies suggest this can lower the temperature inside top-floor flats by two to three degrees. Green roofs, which are covered in plants, have a similar effect, and they also reduce flooding by holding rainwater.
LECTURER: Trees are perhaps the most effective tool of all. A mature tree provides shade and cools the air around it, but cities need to choose species carefully, because some release chemicals that add to air pollution on hot days. Finally, some cities are experimenting with permeable pavements, which allow water to soak through and then evaporate, cooling the street.`;

const LISTENING: Material[] = [
  mat('demo2-l2-festival', 'listening', 'both', 2, 'Radio announcement: a summer festival', 'You will hear a radio presenter giving information about a local festival.', {
    audioScript: L2_FESTIVAL,
    transcript: L2_FESTIVAL,
    tags: ['events', 'local area'],
    groups: [
      g('mcq', 'Choose the correct letter, A, B or C.', [
        q('Why has the festival moved to Elmwood Park?', ['A'], 'The main reason is that the square is being repaved; extra space is a secondary benefit.', ['The square is being repaired.', 'The park is cheaper to hire.', 'Local residents complained about noise.']),
        q('How can visitors pay for event tickets?', ['B'], '"This year we can only accept card payments."', ['by cash only', 'by card only', 'by cash or card']),
      ]),
      g('matching', 'On which day does each event take place? Choose the correct letter, A, B or C. You may use any letter more than once.', [
        q('opening concert', ['A'], 'Friday evening at seven.'),
        q('kite-making workshop', ['B'], 'Saturday morning.'),
        q('food fair', ['B'], 'Saturday afternoon.'),
        q('dragon boat race', ['C'], 'Moved from Saturday to Sunday because of the tides.'),
        q('history walk', ['A'], '"Also on Friday…" at four.'),
      ], { options: ['Friday', 'Saturday', 'Sunday'] }),
      g('completion', 'Complete the sentences. Write ONE WORD AND/OR A NUMBER for each answer.', [
        q('The kite workshop is limited to ______ places.', ['30', 'thirty'], 'Places are limited to thirty.'),
        q('Money from the history walk goes to the local ______.', ['hospice'], 'All the money goes to the local hospice.'),
        q('The free shuttle bus leaves from the ______ station.', ['railway', 'train'], 'The shuttle runs from the railway station every fifteen minutes.'),
      ], { maxWords: 2 }),
    ],
  }),
  mat('demo2-l3-canteen', 'listening', 'both', 3, 'Students planning a food-waste survey', 'You will hear two students, Maya and Tom, planning a presentation about food waste in their university canteen.', {
    audioScript: L3_CANTEEN,
    transcript: L3_CANTEEN,
    tags: ['university', 'environment'],
    groups: [
      g('mcq', 'Choose the correct letter, A, B or C.', [
        q('Which food is wasted most in the canteen?', ['B'], 'Tom expected main courses and Maya expected vegetables, but the data shows bread rolls.', ['main courses', 'bread rolls', 'vegetables']),
        q('Why do the students decide to survey people in person?', ['B'], 'Online response rates are "terrible"; last term\'s survey got about forty replies.', ['It is easier to analyse.', 'Online surveys get few responses.', 'Their tutor requires it.']),
        q('When will they carry out the survey?', ['B'], 'Lunch on Tuesday and Thursday; Friday is rejected.', ['Tuesday and Friday lunchtimes', 'Tuesday and Thursday lunchtimes', 'every lunchtime for a week']),
        q('What will they recommend?', ['B'], 'Rolls on request "might annoy people"; they choose smaller portions with free refills.', ['offering bread only on request', 'smaller portions with free refills', 'charging extra for bread']),
        q('Who will prepare the slides?', ['A'], 'Maya: "I\'ll do them if you write the script."', ['Maya', 'Tom', 'both of them together']),
      ]),
      g('completion', 'Complete the sentence. Write ONE WORD AND/OR A NUMBER.', [
        q('The survey will have no more than ______ questions.', ['8', 'eight'], '"No more than eight."'),
      ], { maxWords: 1 }),
    ],
  }),
  mat('demo2-l4-heat', 'listening', 'both', 4, 'Lecture: urban heat islands', 'You will hear part of a lecture about why cities are warmer than the countryside.', {
    audioScript: L4_HEAT,
    transcript: L4_HEAT,
    tags: ['environment', 'cities'],
    groups: [
      g('completion', 'Complete the notes below. Write ONE WORD ONLY for each answer.', [
        q('The heat island effect is usually strongest at ______.', ['night'], '"The effect is usually strongest at night."'),
        q('Asphalt and concrete release heat slowly after ______.', ['sunset'], 'They absorb heat by day and release it after sunset.'),
        q('Plants cool the air through a process called ______.', ['evapotranspiration'], 'Spelling counts in Listening.'),
        q('Waste heat comes from air-conditioning, vehicles and ______.', ['industry'], 'The third cause.'),
        q('Hot nights are especially dangerous for ______ people.', ['elderly', 'old', 'older'], 'The body cannot recover overnight.'),
        q('More air-conditioning creates a vicious ______.', ['circle'], '"It is a vicious circle."'),
        q('Cool roofs can be painted ______.', ['white'], 'White or reflective materials.'),
        q('Green roofs also reduce ______.', ['flooding', 'floods'], 'They hold rainwater.'),
        q('Some tree species make air ______ worse on hot days.', ['pollution'], 'Some release chemicals that add to air pollution.'),
        q('Permeable pavements allow ______ to soak through.', ['water'], 'Water soaks through and evaporates.'),
      ], { maxWords: 1 }),
    ],
  }),
];

// ---------------------------------- READING ----------------------------------
const RA2_FARMS = `A In a converted warehouse on the edge of a city, lettuce grows in trays stacked twelve levels high. There is no soil and no sunlight: the plants' roots hang in a nutrient solution, and purple-tinted LED lamps provide exactly the wavelengths of light that photosynthesis requires. This is vertical farming, and its supporters believe it could transform the way cities are fed.

B The advantages are easy to list. Because conditions are controlled, crops can be grown all year round regardless of the weather, and pests are rare enough that pesticides are seldom needed. Water use is remarkably low: the water is recycled, so a vertical farm may use around ninety-five per cent less than a field producing the same quantity of leafy greens. And because farms can be built close to the people who eat the food, transport distances are short, and produce can reach shops within hours of being harvested.

C The difficulty is energy. Sunlight is free; electric light is not. Lighting and climate control can account for more than half of a vertical farm's running costs, and if that electricity comes from fossil fuels, the carbon footprint of an indoor lettuce may be higher than that of one grown in a field and transported hundreds of kilometres. Several well-known vertical farming companies have gone out of business in recent years, many of them after energy prices rose sharply.

D The choice of crop is therefore crucial. Leafy greens and herbs are well suited because they grow quickly, are almost entirely edible, and sell for relatively high prices. Staple crops such as wheat and rice, by contrast, are poor candidates: they need a great deal of light, take months to mature, and are cheap to buy. One researcher has calculated that growing enough wheat indoors for a single loaf would cost many times its supermarket price in electricity alone.

E Engineers are working to close the gap. LEDs have become steadily more efficient, and some farms now adjust their lighting schedules to use cheaper electricity at night. Others are being built next to sources of renewable energy or waste heat, such as data centres. Meanwhile, plant scientists are breeding varieties designed for indoor conditions, including compact plants that thrive under artificial light.

F Few experts now believe that vertical farms will replace conventional agriculture. A more likely future is one in which they supply a limited range of perishable, high-value crops to cities, while fields continue to produce the bulk of the world's calories. Even in this modest role, however, they could reduce food waste and make cities less vulnerable to disruptions in long supply chains.`;

const RA3_BOREDOM = `Boredom has a poor reputation. It is associated with idleness, restlessness and, in children, bad behaviour, and an entire industry of entertainment exists largely to help us avoid it. Smartphones have made that avoidance almost effortless: a spare minute at a bus stop or in a queue can now be filled instantly. Yet a growing body of research suggests that in eliminating boredom we may be losing something of value, and I want to argue that a moderate amount of it is not merely harmless but useful.

The first argument concerns creativity. In one frequently cited experiment, participants who had first completed a deliberately dull task, copying numbers from a telephone directory, went on to produce more ideas when asked to think of uses for a pair of plastic cups than participants who had not. The researchers suggested that boredom encourages the mind to wander, and that daydreaming allows people to make connections they would not otherwise make. The effect in such studies is modest, and not every attempt to repeat it has succeeded, so it would be unwise to claim too much. Still, the finding fits with the experience of many writers and scientists who report that their best ideas arrived when they were doing nothing in particular.

A second argument is that boredom is a signal. Just as hunger tells us that we need to eat, boredom tells us that our current activity is not meeting our needs and that we should look for something more meaningful. Seen in this way, the problem is not boredom itself but our response to it. If every flicker of boredom is immediately relieved by a screen, the signal is silenced before it can prompt any real change.

This is particularly relevant for children. Many parents feel that an unoccupied child is a sign of failure on their part, and fill the week with organised activities. I do not doubt that sport, music and other structured pursuits are valuable. But children who are never left to entertain themselves may have fewer opportunities to develop the ability to generate their own plans and interests, a skill that becomes increasingly important as they grow older.

None of this means that boredom should be welcomed without limit. Chronic boredom, the kind that persists for long periods, is associated with poor mental health and risky behaviour, and in workplaces it is linked to mistakes and low morale. The distinction I wish to draw is between the brief, everyday boredom that we have become so eager to escape and the deep, prolonged kind that genuinely harms people. The former, I believe, deserves to be tolerated, perhaps even protected.`;

const RG1_COURSES = `Northbridge Community Centre: Weekend Courses

A Pottery for Beginners
Saturdays, 10 a.m. to 12 noon, for six weeks. All materials are supplied. £85. Pieces are fired in our kiln and are ready to collect two weeks after the course ends.

B Conversational Spanish
Sundays, 2 p.m. to 4 p.m., for eight weeks. For people who already have some basic Spanish. The course book (£12) is not included in the fee of £96. Maximum 12 students.

C First Aid Certificate
One full Saturday, 9 a.m. to 5 p.m. The certificate is valid for three years and is accepted by most employers. £60, lunch provided.

D Smartphone Photography
Saturday afternoons for four weeks. Bring your own phone; no previous experience is needed. £40. The final session includes a photo walk along the river.

E Bread Baking
Two Sundays, 10 a.m. to 3 p.m. Take home everything you bake. £55 including all ingredients. Not suitable for people with gluten allergies.`;

const RG2_LEAVE = `Annual Leave: Guidance for Staff

Entitlement
Full-time staff are entitled to 25 days of paid annual leave per year, plus public holidays. Part-time staff receive a proportional amount based on the hours in their contract. The leave year runs from 1 April to 31 March.

Requesting leave
All requests must be made through the HR portal. For periods of up to three days, give at least one week's notice. For longer periods, at least four weeks' notice is required. Your line manager will normally respond within five working days. Please do not book travel until your leave has been approved.

Busy periods
Because of the volume of orders, leave cannot normally be taken in the last two weeks of November or in December, except for the days when the office is closed between Christmas and New Year. Exceptions may be made in emergencies at the discretion of the department head.

Carrying over leave
Up to five unused days may be carried over to the next leave year. These must be used by 30 June, or they will be lost. Unused leave is not paid as money except when an employee leaves the company.

Sickness during leave
If you become ill while on annual leave, you may be able to reclaim those days as sick leave. You must inform your manager on the first day of illness and provide a medical certificate on your return.`;

const RG3_BICYCLE = `A The first machine that we would recognise as an ancestor of the bicycle appeared in Germany in 1817. Invented by Karl Drais, it had two wheels in line and a wooden frame, but no pedals: riders pushed themselves along with their feet. Drais hoped his "running machine" might partly replace horses, which had become expensive to feed after a series of poor harvests. It was briefly fashionable, but rough roads and complaints from pedestrians soon limited its use.

B Pedals arrived in the 1860s, attached directly to the front wheel. Because each turn of the pedals produced only one turn of the wheel, makers increased speed by making the front wheel larger and larger. The result was the high-wheeler, often called the penny-farthing, whose front wheel could be more than a metre and a half across. It was fast but dangerous: the rider sat high above the ground, and a sudden stop could throw him over the handlebars.

C The design that solved this problem, known as the safety bicycle, appeared in the 1880s. It had two wheels of similar size and a chain that carried power from the pedals to the rear wheel, so speed no longer depended on the size of the wheel. Shortly afterwards, the air-filled tyre developed by John Boyd Dunlop made riding far more comfortable. The basic shape of the bicycle has hardly changed since.

D The safety bicycle had important social effects. It was cheaper than a horse and needed no stable, so for the first time many working people could travel beyond their own neighbourhood. It also gave women a new degree of independence, and changes in women's clothing in the 1890s, such as shorter skirts and loose trousers, were partly driven by the need to ride comfortably.

E Cyclists were also among the first to campaign for better roads. In several countries, cycling clubs lobbied governments to improve road surfaces and put up signposts, years before cars became common. Ironically, the smooth roads they won were soon dominated by motor vehicles, and cycling declined in many places during the twentieth century.

F In recent decades, the bicycle has returned to favour. Concerns about traffic, air quality and health have led many cities to build separate cycle lanes, and electric bicycles have made longer journeys and hilly routes possible for a wider range of people. Two centuries after Drais pushed his machine through the streets, the bicycle remains one of the most efficient forms of transport ever invented.`;

const READING: Material[] = [
  mat('demo2-ra2-farms', 'reading', 'academic', 2, 'Farming upwards', 'You should spend about 20 minutes on the questions based on this passage.', {
    passage: RA2_FARMS,
    tags: ['agriculture', 'technology'],
    groups: [
      g('matching', 'The passage has six paragraphs, A–F. Which paragraph contains the following information? Choose the correct letter, A–F.', [
        q('an example of a crop that would cost too much to grow indoors', ['D'], 'Wheat for a loaf would cost many times its price in electricity.'),
        q('a description of how plants are grown without soil', ['A'], 'Roots hang in a nutrient solution.'),
        q('a reference to companies that have failed', ['C'], '"Several well-known vertical farming companies have gone out of business."'),
        q('a prediction about the future role of vertical farms', ['F'], '"A more likely future is one in which…"'),
        q('ways of reducing the cost of electricity', ['E'], 'Efficient LEDs, cheaper night-time electricity, renewable energy and waste heat.'),
      ], { options: ['Paragraph A', 'Paragraph B', 'Paragraph C', 'Paragraph D', 'Paragraph E', 'Paragraph F'] }),
      g('tfng', 'Do the following statements agree with the information given in the passage? Choose TRUE, FALSE or NOT GIVEN.', [
        q('Pesticides are rarely needed in vertical farms.', ['TRUE'], 'Pests are rare "enough that pesticides are seldom needed".'),
        q('Vertical farms use about half as much water as fields.', ['FALSE'], 'They may use around 95% less, not half.'),
        q('Most vertical farms run on renewable energy.', ['NOT GIVEN'], 'Only "others" are built near renewable sources; no proportion is given.'),
      ]),
      g('completion', 'Complete the sentences. Choose ONE WORD ONLY from the passage for each answer.', [
        q('LED lamps provide the wavelengths of light needed for ______.', ['photosynthesis'], 'Paragraph A.'),
        q('Some farms are built next to data centres to use their waste ______.', ['heat'], 'Paragraph E.'),
      ], { maxWords: 1 }),
      g('mcq', 'Choose the correct letter, A, B, C or D.', [
        q("Which statement best summarises the writer's view of vertical farming?", ['C'], 'Paragraph F: a limited range of high-value crops, while fields produce most calories.', [
          'It will soon replace conventional agriculture.',
          'It has no realistic future because of energy costs.',
          'It is likely to play a useful but limited role.',
          'It should focus on staple crops such as wheat.',
        ]),
      ]),
    ],
  }),
  mat('demo2-ra3-boredom', 'reading', 'academic', 3, 'In defence of boredom', 'You should spend about 20 minutes on the questions based on this passage.', {
    passage: RA3_BOREDOM,
    tags: ['psychology', 'opinion'],
    groups: [
      g('ynng', 'Do the following statements agree with the views of the writer? Choose YES, NO or NOT GIVEN.', [
        q('Smartphones have made it easier to avoid boredom.', ['YES'], 'Avoidance is now "almost effortless".'),
        q('Research on boredom and creativity has produced consistent results.', ['NO'], '"Not every attempt to repeat it has succeeded."'),
        q('Writers experience boredom more often than scientists.', ['NOT GIVEN'], 'Both are mentioned, but they are not compared.'),
        q('Parents should stop enrolling their children in organised activities.', ['NO'], 'The writer says such activities are valuable.'),
        q('Long-lasting boredom can be harmful.', ['YES'], 'Chronic boredom is linked to poor mental health and risky behaviour.'),
      ]),
      g('matching', 'Complete the summary using the list of words, A–H.', [
        q('The writer compares boredom to hunger, describing it as a ______ …', ['A'], 'Paragraph 3: "boredom is a signal".'),
        q('… that tells us to look for something more ______.', ['B'], '"Something more meaningful".'),
        q('If screens relieve boredom at once, the message is ______ too soon.', ['C'], '"The signal is silenced."'),
        q('The writer accepts everyday boredom but not the ______ kind.', ['D'], 'Chronic boredom is the harmful kind.'),
      ], { options: ['signal', 'meaningful', 'silenced', 'chronic', 'reward', 'entertaining', 'ignored', 'creative'] }),
      g('mcq', 'Choose the correct letter, A, B, C or D.', [
        q('In the experiment described, people who first did a dull task', ['B'], 'They "produced more ideas" for uses of plastic cups.', [
          'performed worse on a later test.',
          'suggested more uses for plastic cups.',
          'copied numbers more accurately.',
          'gave up the second task sooner.',
        ]),
        q("What is the writer's main purpose?", ['B'], 'Paragraph 1: "a moderate amount of it is not merely harmless but useful."', [
          'to show that boredom is always harmful',
          'to argue that some boredom is beneficial',
          'to criticise the makers of smartphones',
          'to describe a psychological experiment in detail',
        ]),
      ]),
    ],
  }),
  mat('demo2-rg1-courses', 'reading', 'general', 1, 'Weekend courses at a community centre', 'Read the advertisements and answer the questions.', {
    passage: RG1_COURSES,
    tags: ['everyday', 'advertisements'],
    groups: [
      g('matching', 'Look at the five courses, A–E. Which course matches each statement? You may use any letter more than once.', [
        q('You must buy a book in addition to paying the fee.', ['B'], 'The £12 course book is not included.'),
        q('It takes place on a single day.', ['C'], 'One full Saturday.'),
        q('You need some previous knowledge of the subject.', ['B'], 'For people who already have some basic Spanish.'),
        q('Part of the course happens outdoors.', ['D'], 'A photo walk along the river.'),
        q('You will have to wait before you can take home what you made.', ['A'], 'Ready two weeks after the course ends.'),
        q('A meal is included in the price.', ['C'], 'Lunch provided.'),
        q('It is unsuitable for people with a certain allergy.', ['E'], 'Not suitable for people with gluten allergies.'),
      ], { options: ['Pottery for Beginners', 'Conversational Spanish', 'First Aid Certificate', 'Smartphone Photography', 'Bread Baking'] }),
      g('tfng', 'Do the following statements agree with the information given in the text? Choose TRUE, FALSE or NOT GIVEN.', [
        q('The pottery course costs more than the Spanish course.', ['FALSE'], 'Pottery £85; Spanish £96.'),
        q('The first aid certificate lasts for three years.', ['TRUE'], 'Valid for three years.'),
        q('The photography course is limited to twelve people.', ['NOT GIVEN'], 'The limit of 12 applies to Spanish; no limit is stated for photography.'),
      ]),
    ],
  }),
  mat('demo2-rg2-leave', 'reading', 'general', 2, 'Annual leave: guidance for staff', 'Read the text and answer the questions.', {
    passage: RG2_LEAVE,
    tags: ['workplace'],
    groups: [
      g('completion', 'Complete the sentences. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.', [
        q('Full-time staff receive ______ days of paid leave a year.', ['25', 'twenty-five'], 'Entitlement section.'),
        q('Leave requests must be made through the ______.', ['HR portal'], 'Requesting leave.'),
        q('For leave of more than three days, give at least ______ notice.', ["four weeks'", 'four weeks', "4 weeks'", '4 weeks'], 'Up to three days: one week; longer: four weeks.'),
        q('Staff should not book ______ until leave is approved.', ['travel'], 'Requesting leave.'),
        q('Carried-over days must be used by ______.', ['30 June', 'June 30', '30th June'], 'Otherwise they are lost.'),
        q('After being ill on leave, staff must provide a ______.', ['medical certificate'], 'Sickness during leave.'),
      ], { maxWords: 2 }),
      g('mcq', 'Choose the correct letter, A, B or C.', [
        q('When is leave normally NOT permitted?', ['B'], 'The last two weeks of November and December, except the Christmas closure.', ['in April', 'in late November', 'between Christmas and New Year']),
        q('Unused leave is paid as money when an employee', ['B'], '"except when an employee leaves the company".', ['has more than five days left.', 'leaves the company.', 'works part-time.']),
      ]),
    ],
  }),
  mat('demo2-rg3-bicycle', 'reading', 'general', 3, 'Two centuries of the bicycle', 'Read the passage and answer the questions.', {
    passage: RG3_BICYCLE,
    tags: ['history', 'transport'],
    groups: [
      g('matching', 'The passage has six paragraphs, A–F. Choose the correct heading for each paragraph from the list.', [
        q('Paragraph A', ['B'], 'Drais\'s running machine had no pedals.'),
        q('Paragraph B', ['A'], 'Ever-larger front wheels for speed, and the danger that came with them.'),
        q('Paragraph C', ['E'], 'The safety bicycle\'s shape "has hardly changed since".'),
        q('Paragraph D', ['C'], 'Working people and women gained independence.'),
        q('Paragraph E', ['F'], 'Cyclists campaigned for roads later dominated by cars.'),
        q('Paragraph F', ['G'], 'The bicycle has "returned to favour".'),
      ], {
        options: ['A dangerous race for speed', 'A machine without pedals', 'Freedom for new groups of people', 'Why cars replaced bicycles', 'A design that has lasted', 'Building roads for others', 'A modern revival', 'The first cycling races'],
      }),
      g('tfng', 'Do the following statements agree with the information given in the passage? Choose TRUE, FALSE or NOT GIVEN.', [
        q("Drais's machine was partly intended as an alternative to horses.", ['TRUE'], 'He hoped it might partly replace horses.'),
        q('Riders of the penny-farthing could be thrown forward if they stopped suddenly.', ['TRUE'], '"Over the handlebars".'),
        q('Dunlop also invented the bicycle chain.', ['NOT GIVEN'], 'The passage does not say who designed the chain.'),
        q('Cycling clubs asked for better roads before cars were common.', ['TRUE'], '"Years before cars became common."'),
      ]),
      g('completion', 'Complete the sentences. Choose ONE WORD ONLY from the passage for each answer.', [
        q("In the 1890s, women's ______ changed partly because of cycling.", ['clothing'], 'Paragraph D.'),
        q('Electric bicycles have made longer journeys and ______ routes possible for more people.', ['hilly'], 'Paragraph F.'),
      ], { maxWords: 1 }),
    ],
  }),
];

// ---------------------------------- WRITING ----------------------------------
const WRITING: Material[] = [
  mat('demo2-wa1-energy', 'writing', 'academic', 1, 'Household energy use (two pie charts)', 'You should spend about 20 minutes on this task. Write at least 150 words.', {
    prompt: 'The pie charts below show how energy was used in homes in one country in 1990 and 2020.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.',
    imageUrl: pieCharts(),
    imageAlt: 'Two pie charts. 1990: heating 58%, hot water 22%, cooking 7%, lighting 8%, appliances and electronics 5%. 2020: heating 47%, hot water 18%, cooking 5%, lighting 3%, appliances and electronics 27%.',
    minWords: 150,
    tags: ['pie chart', 'comparison'],
    scoringGuidance: 'Overview: heating remained the largest use in both years although its share fell, while appliances and electronics grew dramatically to become the second-largest category. Good answers group the smaller declining categories (hot water, cooking, lighting) and use accurate percentages and comparative language (rose five-fold, fell by 11 percentage points).',
  }),
  mat('demo2-wa1-rainwater', 'writing', 'academic', 1, 'Rainwater collection (process diagram)', 'You should spend about 20 minutes on this task. Write at least 150 words.', {
    prompt: 'The diagram below shows how rainwater is collected and used in a house.\n\nSummarise the information by selecting and reporting the main features.',
    imageUrl: processDiagram(),
    imageAlt: 'Process diagram in six stages: 1 rain falls on the roof; 2 it runs through gutters and a downpipe; 3 a leaf filter removes debris; 4 a first-flush diverter discards the first, dirtiest water; 5 the water is stored in an underground tank, which has an overflow pipe to a soakaway; 6 a pump sends the water to toilets and the washing machine, and to the garden.',
    minWords: 150,
    tags: ['process', 'diagram'],
    scoringGuidance: 'An overview should state the number of stages and the overall purpose (collecting, cleaning and storing rainwater for non-drinking uses). Strong answers use passive forms (is collected, is filtered, is pumped), sequencing language, and mention the overflow route. They should not describe the uses in more detail than the diagram shows.',
    modelAnswer: `The diagram illustrates how rainwater falling on a house is collected, cleaned, stored and then used for household purposes.

Overall, the process consists of six main stages, beginning with rain on the roof and ending with the water being pumped to parts of the house and garden. The water is filtered twice before it is stored, and it is used only for purposes that do not require drinking-quality water.

First, rain lands on the roof and is channelled into gutters, from which it flows down a pipe. It then passes through a leaf filter, which removes leaves and other debris. At the next stage, a first-flush diverter discards the first and dirtiest portion of the water, so that only cleaner water continues through the system.

This water is then stored in an underground tank. If the tank becomes full, excess water leaves through an overflow pipe and drains into a soakaway. Finally, when water is needed, a pump draws it from the tank and supplies it to the toilets and washing machine inside the house, as well as to the garden.`,
  }),
  mat('demo2-wg1-council', 'writing', 'general', 1, 'Letter: a problem in a local park', 'You should spend about 20 minutes on this task. Write at least 150 words. You do NOT need to write any addresses. Begin your letter as follows: Dear Sir or Madam,', {
    prompt: 'The park near your home has recently become dirty and is not well maintained.\n\nWrite a letter to your local council. In your letter:',
    bullets: ['describe the problems in the park', 'explain how these problems affect local residents', 'suggest what the council should do'],
    minWords: 150,
    tags: ['letter', 'formal', 'complaint'],
    scoringGuidance: 'Formal register throughout. Each bullet should be developed with specific detail (overflowing bins, broken play equipment, uncut grass). The suggestions should be realistic and clearly linked to the problems. Close with "Yours faithfully".',
    modelAnswer: `Dear Sir or Madam,

I am writing to draw your attention to the condition of Hillside Park, which is next to my home on Carter Road and which has deteriorated considerably over the past few months.

The most obvious problem is litter. The bins near the main entrance are rarely emptied, so rubbish spills onto the paths, and on windy days it is blown across the grass and into the pond. In addition, two of the swings in the children's play area have been broken since the spring, and the grass has not been cut for several weeks.

These problems affect many residents. Parents have stopped taking young children to the play area because they consider it unsafe, and elderly neighbours who used to walk there every morning now find the paths unpleasant. The litter has also attracted rats, which several residents have reported seeing near the houses.

I would therefore ask the council to empty the bins at least twice a week, repair or replace the damaged equipment, and restore a regular mowing schedule. Installing a few more bins along the main path would also help.

I look forward to hearing what action the council intends to take.

Yours faithfully,
Minh Anh Pham`,
  }),
  mat('demo2-wg1-interview', 'writing', 'general', 1, 'Letter: rearranging a job interview', 'You should spend about 20 minutes on this task. Write at least 150 words. You do NOT need to write any addresses. Begin your letter as follows: Dear Mr Collins,', {
    prompt: 'You have been invited to a job interview, but you cannot attend on the date the company has given.\n\nWrite a letter to the company’s HR manager, Mr Collins. In your letter:',
    bullets: ['thank him for the invitation and explain why you cannot attend', 'suggest some alternative dates and times', 'ask a question about the interview'],
    minWords: 150,
    tags: ['letter', 'semi-formal'],
    scoringGuidance: 'Polite, semi-formal register (named recipient, so "Yours sincerely"). The reason should be genuine and briefly explained. Alternative dates should be specific, and the question should be relevant (format, documents, who will attend).',
  }),
  mat('demo2-w2-service', 'writing', 'both', 2, 'Essay: compulsory community service', 'You should spend about 40 minutes on this task. Write at least 250 words.', {
    prompt: 'Some people believe that unpaid community service should be a compulsory part of high school programmes, for example working for a charity, improving the neighbourhood or teaching sports to younger children.\n\nTo what extent do you agree or disagree?\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.',
    minWords: 250,
    tags: ['education', 'opinion'],
    scoringGuidance: 'A clear position on the word "compulsory" is essential. Typical arguments: civic responsibility, practical skills and empathy versus academic pressure, unwilling participants and fairness to students with jobs or caring duties. Each body paragraph should develop one main idea with an example.',
  }),
  mat('demo2-w2-museums', 'writing', 'both', 2, 'Essay: why locals avoid museums', 'You should spend about 40 minutes on this task. Write at least 250 words.', {
    prompt: 'In many cities, museums and historical sites are mainly visited by tourists rather than by local people.\n\nWhy is this the case? What can be done to attract more local visitors?\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.',
    minWords: 250,
    tags: ['culture', 'two-part question'],
    scoringGuidance: 'Both questions need full answers: causes (familiarity, cost, lack of time, the feeling that exhibitions never change) and solutions (free days for residents, evening events, changing exhibitions, school partnerships). Solutions should respond to the causes identified.',
  }),
  mat('demo2-w2-remote', 'writing', 'both', 2, 'Essay: working from home', 'You should spend about 40 minutes on this task. Write at least 250 words.', {
    prompt: 'Some people think that working from home benefits both employees and employers. Others believe it causes more problems than it solves.\n\nDiscuss both these views and give your own opinion.\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.',
    minWords: 250,
    tags: ['work', 'discuss both views'],
    scoringGuidance: 'Both views need balanced development, and the writer’s own opinion must be clear. Avoid listing many undeveloped ideas; two well-explained points per side are enough.',
    modelAnswer: `Since many companies were forced to send staff home during the pandemic, working from home has become a permanent arrangement for millions of employees. While some argue that it benefits everyone involved, others claim it creates serious difficulties. In my view, remote work is valuable, but it works best when combined with regular time in the office.

Supporters of home working point first to the time and money it saves. An employee who no longer commutes for an hour each way gains ten hours a week, which can be spent with family, exercising or simply resting, and this often leads to greater job satisfaction. Employers can also benefit: they may need smaller offices, and they can recruit talented people who live far from the company's headquarters.

On the other hand, there are genuine drawbacks. Many workers find it difficult to separate their professional and private lives when their kitchen table is also their desk, and some end up working longer hours rather than fewer. Young employees in particular may suffer, because they learn a great deal by watching experienced colleagues and asking quick questions, which is much harder over video calls. Managers also report that spontaneous collaboration and a sense of team identity can weaken over time.

In my opinion, the strongest approach is a hybrid one. If staff spend two or three days a week in the office for meetings, training and teamwork, and work from home on the remaining days for tasks that require concentration, both employees and employers can enjoy most of the advantages while avoiding the worst of the problems.`,
  }),
];

// ---------------------------------- SPEAKING ----------------------------------
const SPEAKING: Material[] = [
  mat('demo2-s1-work', 'speaking', 'both', 1, 'Part 1: work or study, and the weather', 'The examiner asks you some questions about yourself. Answer each question in two to four sentences.', {
    speakingQuestions: [
      'Do you work, or are you a student?',
      'What do you enjoy most about your job or your studies?',
      'What is the weather usually like where you live?',
      'Do you prefer hot weather or cold weather? Why?',
      'Does the weather ever affect your mood?',
    ],
    responseSeconds: 30,
    tags: ['work', 'weather', 'familiar topics'],
  }),
  mat('demo2-s1-reading', 'speaking', 'both', 1, 'Part 1: reading and getting around', 'The examiner asks you some questions about yourself. Answer each question in two to four sentences.', {
    speakingQuestions: [
      'Do you enjoy reading?',
      'What kinds of things do you usually read?',
      'How do you usually travel around your town or city?',
      'Do you think public transport where you live could be improved?',
      'Did you often use public transport when you were a child?',
    ],
    responseSeconds: 30,
    tags: ['reading', 'transport', 'familiar topics'],
  }),
  mat('demo2-s2-story', 'speaking', 'both', 2, 'Part 2: a book or film that made an impression', 'You will have one minute to prepare. You can make notes. Then talk for one to two minutes.', {
    prompt: 'Describe a book or film that made a strong impression on you.',
    bullets: ['what it was and when you read or watched it', 'what it was about', 'why you chose to read or watch it', 'and explain why it made such a strong impression on you'],
    prepSeconds: 60,
    responseSeconds: 120,
    tags: ['topic:stories'],
    scoringGuidance: 'Avoid retelling the whole plot: a brief summary, then focus on personal reaction and reasons. Past tenses and evaluative language (moving, thought-provoking, it stayed with me) support Lexical Resource and Grammatical Range.',
  }),
  mat('demo2-s2-relax', 'speaking', 'both', 2, 'Part 2: a place where people relax', 'You will have one minute to prepare. You can make notes. Then talk for one to two minutes.', {
    prompt: 'Describe a place in your town or city where people go to relax.',
    bullets: ['where it is', 'what it looks like', 'what people do there', 'and explain why it is a good place to relax'],
    prepSeconds: 60,
    responseSeconds: 120,
    tags: ['topic:places'],
  }),
  mat('demo2-s3-stories', 'speaking', 'both', 3, 'Part 3: books, films and storytelling', 'The examiner asks you more general questions linked to the Part 2 topic. Give developed answers with reasons and examples.', {
    speakingQuestions: [
      'Why do some people prefer watching films to reading books?',
      'Should a film based on a novel stay close to the original story?',
      'How has the way people watch films changed in recent years?',
      'Do you think reading for pleasure will become less common in the future?',
    ],
    responseSeconds: 60,
    tags: ['topic:stories'],
  }),
  mat('demo2-s3-places', 'speaking', 'both', 3, 'Part 3: public spaces and free time', 'The examiner asks you more general questions linked to the Part 2 topic. Give developed answers with reasons and examples.', {
    speakingQuestions: [
      'Why is it important for cities to have green spaces?',
      'Who should pay for public parks: local government or the people who use them?',
      'How might cities be designed differently in the future?',
      'Do people today have less free time than people did in the past?',
    ],
    responseSeconds: 60,
    tags: ['topic:places'],
  }),
];

export const MORE_MATERIALS: Material[] = [...LISTENING, ...READING, ...WRITING, ...SPEAKING];
