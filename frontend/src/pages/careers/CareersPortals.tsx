import { api } from '../../lib/api'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Globe, Plus, Trash2, Save, ExternalLink, Flag,
  Loader2, Search, Check, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { PortalsConfig, Portal } from '../../types/careers'
import PerfilTabs from '../../components/careers/PerfilTabs'
import { useTranslation } from '../../lib/i18n/LanguageContext'


// Portales chilenos preconfigurados
const CHILE_PORTALS: Omit<Portal, 'enabled'>[] = [
  {
    name: 'GetOnBoard Chile',
    careers_url: 'https://www.getonbrd.com/jobs',
    country: 'Chile',
  },
  {
    name: 'Laborum Chile',
    careers_url: 'https://www.laborum.cl',
    country: 'Chile',
  },
  {
    name: 'Trabajando Chile',
    careers_url: 'https://www.trabajando.cl',
    country: 'Chile',
  },
  {
    name: 'Bumeran Chile',
    careers_url: 'https://www.bumeran.cl',
    country: 'Chile',
  },
  {
    name: 'Computrabajo Chile',
    careers_url: 'https://cl.computrabajo.com',
    country: 'Chile',
  },
  {
    name: 'Indeed Chile',
    careers_url: 'https://cl.indeed.com',
    country: 'Chile',
  },
  {
    name: 'LinkedIn Jobs Chile',
    careers_url: 'https://www.linkedin.com/jobs/search/?location=Chile',
    country: 'Chile',
  },
  {
    name: 'YWork Chile',
    careers_url: 'https://www.yw.cl',
    country: 'Chile',
  },
]

// Portales de trabajo remoto global preconfigurados
const GLOBAL_PORTALS: Omit<Portal, 'enabled'>[] = [
  {
    name: 'LinkedIn Jobs (Remoto)',
    careers_url: 'https://www.linkedin.com/jobs/search/?keywords=remote',
    country: 'Remoto',
  },
  {
    name: 'Indeed (Remoto)',
    careers_url: 'https://www.indeed.com/q-Remote-jobs.html',
    country: 'Remoto',
  },
  {
    name: 'Wellfound',
    careers_url: 'https://wellfound.com/jobs',
    country: 'Remoto',
  },
  {
    name: 'RemoteOK',
    careers_url: 'https://remoteok.com',
    country: 'Remoto',
  },
  {
    name: 'We Work Remotely',
    careers_url: 'https://weworkremotely.com',
    country: 'Remoto',
  },
  {
    name: 'Himalayas',
    careers_url: 'https://himalayas.app/jobs',
    country: 'Remoto',
  },
]

// Portales preconfigurados para Estados Unidos
const US_PORTALS: Omit<Portal, 'enabled'>[] = [
  {
    name: 'Indeed US',
    careers_url: 'https://www.indeed.com',
    country: 'Estados Unidos',
  },
  {
    name: 'LinkedIn Jobs US',
    careers_url: 'https://www.linkedin.com/jobs/search/?location=United%20States',
    country: 'Estados Unidos',
  },
  {
    name: 'Built In',
    careers_url: 'https://builtin.com/jobs',
    country: 'Estados Unidos',
  },
  {
    name: 'Dice',
    careers_url: 'https://www.dice.com',
    country: 'Estados Unidos',
  },
  {
    name: 'Glassdoor Jobs',
    careers_url: 'https://www.glassdoor.com/Job/index.htm',
    country: 'Estados Unidos',
  },
]

// Portales preconfigurados para España
const SPAIN_PORTALS: Omit<Portal, 'enabled'>[] = [
  {
    name: 'InfoJobs',
    careers_url: 'https://www.infojobs.net',
    country: 'España',
  },
  {
    name: 'Tecnoempleo',
    careers_url: 'https://www.tecnoempleo.com',
    country: 'España',
  },
  {
    name: 'LinkedIn Jobs España',
    careers_url: 'https://www.linkedin.com/jobs/search/?location=Espa%C3%B1a',
    country: 'España',
  },
  {
    name: 'Indeed España',
    careers_url: 'https://es.indeed.com',
    country: 'España',
  },
]

// Portales LATAM bilingües/regionales (México y Colombia como referencia — ajustable según el país objetivo)
const LATAM_PORTALS: Omit<Portal, 'enabled'>[] = [
  {
    name: 'OCC Mundial (México)',
    careers_url: 'https://www.occ.com.mx',
    country: 'México',
  },
  {
    name: 'LinkedIn Jobs México',
    careers_url: 'https://www.linkedin.com/jobs/search/?location=M%C3%A9xico',
    country: 'México',
  },
  {
    name: 'Elempleo (Colombia)',
    careers_url: 'https://www.elempleo.com',
    country: 'Colombia',
  },
  {
    name: 'Computrabajo LATAM',
    careers_url: 'https://www.computrabajo.com',
    country: 'LATAM',
  },
]

// Fallback para portales sin dominio confirmado: busca en Google en vez de inventar una URL
const searchFallback = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q + ' jobs')}`
const igFallback = (handle: string) => `https://www.instagram.com/${handle}/`
const liSearchFallback = (q: string) => `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(q)}`

// Catálogo extendido de portales/agencias sugeridos por Diego (2026-07-15) — lista larga,
// se muestra bajo demanda vía botón "Más Portales" en vez de saturar los tabs regionales.
const MORE_PORTALS: Omit<Portal, 'enabled'>[] = [
  { name: 'GoAbroad Jobs', careers_url: 'https://jobs.goabroad.com/', country: 'Internacional' },
  { name: 'OverseasJobs', careers_url: 'https://www.overseasjobs.com/', country: 'Internacional' },
  { name: 'JobsInNetwork', careers_url: 'https://www.jobsinnetwork.com/', country: 'Internacional' },
  { name: 'Hiring Cafe', careers_url: 'https://hiring.cafe/', country: 'Internacional' },
  { name: 'Snagajob', careers_url: 'https://www.snagajob.com/', country: 'Estados Unidos' },
  { name: 'Wellfound Remote', careers_url: 'https://wellfound.com/remote', country: 'Remoto' },
  { name: 'Quora', careers_url: 'https://www.quora.com/', country: 'Internacional' },
  { name: 'Stillhiring.today', careers_url: 'https://stillhiring.today/', country: 'Remoto' },
  { name: 'Wiseful', careers_url: searchFallback('Wiseful'), country: 'Remoto' },
  { name: 'InHerSight', careers_url: 'https://www.inhersight.com/', country: 'Internacional' },
  { name: 'The Ladders', careers_url: 'https://www.theladders.com/', country: 'Estados Unidos' },
  { name: 'Massive', careers_url: searchFallback('Massive jobs platform'), country: 'Remoto' },
  { name: 'Media Bistro', careers_url: 'https://www.mediabistro.com/', country: 'Estados Unidos' },
  { name: 'Hire Black', careers_url: searchFallback('Hire Black'), country: 'Estados Unidos' },
  { name: 'RemoteHub', careers_url: 'https://www.remotehub.com/', country: 'Remoto' },
  { name: 'Job Board AI', careers_url: searchFallback('Job Board AI'), country: 'Remoto' },
  { name: 'VirtualStaff.PH', careers_url: 'https://virtualstaff.ph/', country: 'Filipinas' },
  { name: 'PeoplePerHour', careers_url: 'https://www.peopleperhour.com/', country: 'Freelance' },
  { name: 'RemoteJobs.io', careers_url: 'https://remotejobs.io/', country: 'Remoto' },
  { name: 'JustRemote', careers_url: 'https://justremote.co/', country: 'Remoto' },
  { name: 'Remote.com', careers_url: 'https://remote.com/', country: 'Remoto' },
  { name: 'PowerToFly', careers_url: 'https://powertofly.com/', country: 'Internacional' },
  { name: 'Dynamite Jobs', careers_url: 'https://dynamitejobs.com/', country: 'Remoto' },
  { name: 'Jobgether', careers_url: 'https://jobgether.com/', country: 'Remoto' },
  { name: 'Virtual Vocations', careers_url: 'https://www.virtualvocations.com/', country: 'Remoto' },
  { name: 'Gun.io', careers_url: 'https://gun.io/', country: 'Freelance' },
  { name: 'Underdog.io', careers_url: 'https://underdog.io/', country: 'Estados Unidos' },
  { name: 'Handshake', careers_url: 'https://joinhandshake.com/', country: 'Estados Unidos' },
  { name: 'Djinni', careers_url: 'https://djinni.co/', country: 'Internacional' },
  { name: 'StartupJobs', careers_url: searchFallback('Startupsuch jobs'), country: 'Remoto' },
  { name: 'The Hub', careers_url: searchFallback('The Hub jobs board'), country: 'Remoto' },
  { name: 'Landing.jobs', careers_url: 'https://landing.jobs/', country: 'España' },
  { name: 'Connect Job', careers_url: searchFallback('Connect Job'), country: 'Internacional' },
  { name: 'JobKorea', careers_url: 'https://www.jobkorea.co.kr/', country: 'Asia' },
  { name: 'CT Good Jobs', careers_url: 'https://www.ctgoodjobs.hk/', country: 'Asia' },
  { name: 'e27 Jobs', careers_url: 'https://e27.co/jobs/', country: 'Asia' },
  { name: 'JobsDB', careers_url: 'https://www.jobsdb.com/', country: 'Asia' },
  { name: 'Jobspresso', careers_url: 'https://jobspresso.co/', country: 'Remoto' },
  { name: 'FlexJobs', careers_url: 'https://www.flexjobs.com/', country: 'Remoto' },
  { name: 'Inclusively Remote', careers_url: searchFallback('inclusevelyremote.com'), country: 'Remoto' },
  { name: 'Migrate Mate', careers_url: searchFallback('Migrate Mate jobs'), country: 'Internacional' },
  { name: 'Real Work From Anywhere', careers_url: searchFallback('Real Work From Anywhere'), country: 'Remoto' },
  { name: 'Graphic Design Jobs UK', careers_url: 'https://www.graphicdesignjobs.co.uk/', country: 'España' },
  { name: 'Dribbble Jobs', careers_url: 'https://dribbble.com/jobs', country: 'Freelance' },
  { name: 'If You Could Jobs', careers_url: 'https://ifyoucouldjobs.com/', country: 'Internacional' },
  { name: 'The Generalist World', careers_url: 'https://www.generalist.world/', country: 'Remoto' },
  { name: 'Remote 100k', careers_url: searchFallback('Remote 100k jobs'), country: 'Remoto' },
  { name: 'NoDesk', careers_url: 'https://nodesk.co/', country: 'Remoto' },
  { name: 'Flexa Careers', careers_url: 'https://flexa.careers/', country: 'Remoto' },
  { name: 'Toptal', careers_url: 'https://www.toptal.com/', country: 'Freelance' },
  { name: 'Pangian', careers_url: 'https://pangian.com/', country: 'Remoto' },
  { name: 'Contra', careers_url: 'https://contra.com/', country: 'Freelance' },
  { name: 'Arc.dev', careers_url: 'https://arc.dev/', country: 'Remoto' },
  { name: 'Welcome to the Jungle', careers_url: 'https://www.welcometothejungle.com/', country: 'España' },
  { name: 'Work in Startups', careers_url: 'https://workinstartups.com/', country: 'Internacional' },
  { name: 'Remote Leverage', careers_url: searchFallback('Remote Leverage'), country: 'Remoto' },
  { name: 'Global Talents EK', careers_url: igFallback('global.talents.ek'), country: 'LATAM' },
  { name: 'The Cozy Agency', careers_url: igFallback('the.cozy.agency'), country: 'LATAM' },
  { name: 'Hire LATAM', careers_url: 'https://www.hirelatam.com/', country: 'LATAM' },
  { name: 'Bridgeways Careers', careers_url: igFallback('bridgewayscareers'), country: 'LATAM' },
  { name: 'WBN Jobs', careers_url: igFallback('wbn_jobs'), country: 'LATAM' },
  { name: 'Knight Shift Solutions', careers_url: searchFallback('Knight Shift Solutions'), country: 'LATAM' },
  { name: 'Milanlab Agency', careers_url: igFallback('milanlab_agency'), country: 'LATAM' },
  { name: 'QRS Official', careers_url: igFallback('qrs.officialsite'), country: 'LATAM' },
  { name: 'Value Add Marketing', careers_url: igFallback('valueaddmarketing'), country: 'LATAM' },
  { name: 'Loopae Talent', careers_url: igFallback('loopae.talent'), country: 'LATAM' },
  { name: 'Staffing Nest', careers_url: igFallback('staffingnest'), country: 'LATAM' },
  { name: 'Vintti', careers_url: 'https://www.vintti.com/', country: 'LATAM' },
  { name: 'Near', careers_url: 'https://www.near.co/', country: 'LATAM' },
  { name: 'Zagged', careers_url: liSearchFallback('Zagged'), country: 'LATAM' },
  { name: 'Remote Talent LATAM', careers_url: liSearchFallback('Remote Talent LATAM'), country: 'LATAM' },
  { name: 'Rec Latam', careers_url: liSearchFallback('Rec Latam'), country: 'LATAM' },
  { name: 'RecruitingSKULL', careers_url: liSearchFallback('RecruitingSKULL'), country: 'LATAM' },
  { name: 'Global Talent Connections', careers_url: 'https://globaltalentconnections.es/', country: 'España' },
  { name: 'Interfell (Simera)', careers_url: 'https://interfell.simera.io/', country: 'LATAM' },
  { name: 'Oberstaff', careers_url: searchFallback('Oberstaff'), country: 'LATAM' },
  { name: 'Chumi IT', careers_url: searchFallback('chumi-it.com'), country: 'LATAM' },
  { name: 'Alphas Remote Team', careers_url: 'https://alphasremote.team/', country: 'LATAM' },
  { name: 'Talently', careers_url: 'https://talently.tech/', country: 'LATAM' },
  { name: 'We Are Tims', careers_url: searchFallback('We Are Tims'), country: 'LATAM' },
  { name: 'ScrumLaunch', careers_url: 'https://www.scrumlaunch.com/', country: 'LATAM' },
  { name: 'Advantra', careers_url: liSearchFallback('Advantra'), country: 'LATAM' },
  { name: 'VTM Jobs', careers_url: 'https://vtmjobs.com/', country: 'LATAM' },
  { name: 'Lupa Hire', careers_url: searchFallback('Lupa Hire'), country: 'LATAM' },
  { name: 'Athyna', careers_url: 'https://athyna.com/', country: 'LATAM' },
  { name: 'Talent Harbor', careers_url: liSearchFallback('Talent Harbor'), country: 'LATAM' },
  { name: 'Fetcher', careers_url: 'https://fetcher.ai/', country: 'Internacional' },
  { name: 'Deel', careers_url: 'https://www.deel.com/', country: 'Internacional' },
  { name: 'Newcombin', careers_url: searchFallback('newcombin.com'), country: 'LATAM' },
  { name: 'Hire with Jarvis', careers_url: liSearchFallback('Hire with Jarvis'), country: 'LATAM' },
  { name: 'Vacantes Digitales', careers_url: 'https://vacantesdigitales.com/', country: 'LATAM' },
  { name: 'Floowi', careers_url: 'https://floowi.com/', country: 'LATAM' },
  { name: 'Hire in LATAM', careers_url: searchFallback('Hire in LATAM'), country: 'LATAM' },
  { name: 'LATAM Hire', careers_url: searchFallback('LATAM Hire'), country: 'LATAM' },
  { name: 'Sagan Recruitment', careers_url: 'https://www.saganrecruitment.com/', country: 'LATAM' },
  { name: 'Hire Matchmaker', careers_url: searchFallback('Hire Matchmaker'), country: 'LATAM' },
  { name: 'LatHire', careers_url: searchFallback('LatHire'), country: 'LATAM' },
  { name: 'Hire Top Remote Talent LATAM', careers_url: searchFallback('Hire top remote talent from latam'), country: 'LATAM' },
  { name: 'Hire Central', careers_url: searchFallback('Hire Central LATAM'), country: 'LATAM' },
  { name: 'Remotely Talents', careers_url: searchFallback('Remotely Talents'), country: 'LATAM' },
  { name: 'Bullpen Talent', careers_url: searchFallback('Bullpen Talent'), country: 'LATAM' },
  { name: 'LATAM Jobs', careers_url: searchFallback('LATAM Jobs board'), country: 'LATAM' },
  { name: 'Select Assistants', careers_url: searchFallback('Select Assistants'), country: 'LATAM' },
  { name: 'Rad Hires', careers_url: searchFallback('Rad Hires'), country: 'LATAM' },
  { name: 'TLNT', careers_url: searchFallback('TLNT remote talent LATAM'), country: 'LATAM' },
  { name: 'Latino Legends', careers_url: searchFallback('Latino Legends'), country: 'LATAM' },
  { name: 'Activate Talent', careers_url: searchFallback('Activate Talent'), country: 'LATAM' },
  { name: 'LATAMCent', careers_url: 'https://latamcent.com/', country: 'LATAM' },
  { name: 'HireBoost', careers_url: searchFallback('HireBoost'), country: 'LATAM' },
  { name: 'Kala Talent', careers_url: searchFallback('Kala Talent'), country: 'LATAM' },
  { name: 'Howdy', careers_url: 'https://www.howdy.com/', country: 'LATAM' },
  { name: 'WorldTeams', careers_url: searchFallback('WorldTeams'), country: 'LATAM' },
  { name: 'Sur LATAM', careers_url: searchFallback('Sur LATAM staffing'), country: 'LATAM' },
  { name: 'Strider', careers_url: searchFallback('Strider staffing'), country: 'LATAM' },
  { name: 'Virtual Wizards', careers_url: searchFallback('Virtual Wizards'), country: 'LATAM' },
  { name: 'Somewhere', careers_url: 'https://www.somewhere.com/', country: 'LATAM' },
  { name: 'RemoteVA', careers_url: searchFallback('RemoteVA'), country: 'LATAM' },
  { name: 'Remote Recruitment', careers_url: searchFallback('Remote Recruitment agency'), country: 'LATAM' },
  { name: 'Emapta Global', careers_url: 'https://www.emapta.com/', country: 'Filipinas' },
  { name: 'GoTeam', careers_url: 'https://goteam.com.ph/', country: 'Filipinas' },
  { name: 'Outsourced', careers_url: 'https://outsourced.ph/', country: 'Filipinas' },
  { name: 'Scale Army Careers', careers_url: searchFallback('Scale Army Careers'), country: 'LATAM' },
  { name: 'JobDuck', careers_url: 'https://jobduck.com/', country: 'Filipinas' },
  { name: 'Cloudstaff', careers_url: 'https://www.cloudstaff.com/', country: 'Filipinas' },
  { name: 'Crossing Hurdles', careers_url: searchFallback('Crossing Hurdles'), country: 'LATAM' },
  { name: 'Legal Soft', careers_url: searchFallback('Legal Soft staffing'), country: 'LATAM' },
  { name: 'Solvo Global', careers_url: 'https://www.solvoglobal.com/', country: 'LATAM' },
  { name: 'We Are Oasis', careers_url: searchFallback('We Are Oasis staffing'), country: 'LATAM' },
  { name: 'Valatam', careers_url: 'https://valatam.com/', country: 'LATAM' },
  { name: 'Allied Global', careers_url: searchFallback('Allied Global BPO careers'), country: 'LATAM' },
  { name: 'Resilient Co', careers_url: searchFallback('Resilient Co staffing'), country: 'LATAM' },
  { name: 'Scalepex', careers_url: searchFallback('Scalepex'), country: 'LATAM' },
  { name: 'Arch LATAM', careers_url: 'https://cam.archlatam.com/', country: 'LATAM' },
  { name: 'GSM Tech', careers_url: searchFallback('GSM Tech staffing'), country: 'LATAM' },
  { name: 'Hire South', careers_url: searchFallback('Hire South'), country: 'LATAM' },
  { name: 'Simpalm Staffing', careers_url: searchFallback('Simpalm Staffing'), country: 'LATAM' },
  { name: 'Tech Talent Center', careers_url: searchFallback('Techtalent Center'), country: 'LATAM' },
  { name: 'nCube', careers_url: searchFallback('nCube staffing'), country: 'LATAM' },
  { name: 'TeamUp Staff Augmentation', careers_url: searchFallback('TeamUp Staff Augmentation'), country: 'LATAM' },
  { name: 'Vartanix', careers_url: searchFallback('Vartanix'), country: 'LATAM' },
  { name: 'BA Global Talent', careers_url: 'https://careers.baglobaltalent.com/', country: 'LATAM' },
  { name: 'Workable Apply', careers_url: 'https://apply.workable.com/', country: 'Internacional' },
  { name: 'Pearl Talent', careers_url: 'https://www.pearltalent.com/', country: 'LATAM' },
  { name: 'Upwork', careers_url: 'https://www.upwork.com/', country: 'Freelance' },
  { name: 'Fiverr', careers_url: 'https://www.fiverr.com/', country: 'Freelance' },
  { name: 'Freelancer', careers_url: 'https://www.freelancer.com/', country: 'Freelance' },
  { name: 'GG Designs', careers_url: searchFallback('Ggdesigns'), country: 'Freelance' },
  { name: 'DesignCrowd', careers_url: 'https://www.designcrowd.com/', country: 'Freelance' },
  { name: 'Behance Joblist', careers_url: 'https://www.behance.net/joblist', country: 'Freelance' },
  { name: 'Hubstaff Talent', careers_url: 'https://talent.hubstaff.com/', country: 'Freelance' },
  { name: 'Workana', careers_url: 'https://www.workana.com/', country: 'LATAM' },
  { name: 'GrowthHackers', careers_url: 'https://growthhackers.com/', country: 'Internacional' },
  { name: 'Toptal Designers', careers_url: 'https://www.toptal.com/designers', country: 'Freelance' },
  { name: 'SEOClerks', careers_url: 'https://www.seoclerks.com/', country: 'Freelance' },
  { name: 'Clickworker', careers_url: 'https://www.clickworker.com/', country: 'Freelance' },
  { name: 'Amazon MTurk', careers_url: 'https://www.mturk.com/', country: 'Freelance' },
  { name: 'Microworkers', careers_url: 'https://microworkers.com/', country: 'Freelance' },
  { name: 'Remotasks', careers_url: 'https://www.remotasks.com/', country: 'Freelance' },
  { name: 'Appen', careers_url: 'https://appen.com/', country: 'Freelance' },
  { name: 'LiveOps', careers_url: 'https://www.liveops.com/', country: 'Estados Unidos' },
  { name: 'Working Solutions', careers_url: 'https://www.workingsolutions.com/', country: 'Estados Unidos' },
  { name: 'Support.com', careers_url: 'https://www.support.com/', country: 'Estados Unidos' },
  { name: 'Arise', careers_url: 'https://www.arise.com/', country: 'Estados Unidos' },
  { name: 'SimplyHired', careers_url: 'https://www.simplyhired.com/', country: 'Estados Unidos' },
  { name: 'Salesforce Careers', careers_url: 'https://careers.salesforce.com/', country: 'Estados Unidos' },
  { name: 'We Work Remotely', careers_url: 'https://weworkremotely.com/', country: 'Remoto' },
  { name: 'Turing', careers_url: 'https://www.turing.com/', country: 'Remoto' },
  { name: 'Hirable', careers_url: searchFallback('Hirable jobs'), country: 'Remoto' },
  { name: 'ProBlogger Jobs', careers_url: 'https://problogger.com/jobs/', country: 'Freelance' },
  { name: 'Contena', careers_url: 'https://www.contena.co/', country: 'Freelance' },
  { name: 'Textbroker', careers_url: 'https://www.textbroker.com/', country: 'Freelance' },
  { name: 'iWriter', careers_url: 'https://iwriter.com/', country: 'Freelance' },
  { name: 'Scripted', careers_url: 'https://www.scripted.com/', country: 'Freelance' },
  { name: 'Hootsuite Careers', careers_url: 'https://www.hootsuite.com/company/careers', country: 'Remoto' },
  { name: 'Buffer Careers', careers_url: 'https://buffer.com/journey', country: 'Remoto' },
  { name: 'SocialBoe', careers_url: searchFallback('socialBoe.io'), country: 'Freelance' },
  { name: 'Rev', careers_url: 'https://www.rev.com/freelancers', country: 'Freelance' },
  { name: 'TranscribeMe', careers_url: 'https://transcribeme.com/', country: 'Freelance' },
  { name: 'One Hour Translation', careers_url: 'https://www.onehourtranslation.com/', country: 'Freelance' },
  { name: 'Crowdsurf Work', careers_url: searchFallback('Crowdsurf work'), country: 'Freelance' },
  { name: 'LawTrades', careers_url: searchFallback('LawTrades'), country: 'Freelance' },
  { name: 'UpCounsel', careers_url: 'https://www.upcounsel.com/', country: 'Freelance' },
  { name: 'HireAnEsquire', careers_url: searchFallback('Hire an Esquire'), country: 'Estados Unidos' },
  { name: 'LegalZoom', careers_url: 'https://www.legalzoom.com/', country: 'Estados Unidos' },
  { name: 'Hopin', careers_url: 'https://hopin.com/', country: 'Remoto' },
  { name: 'Eventbrite', careers_url: 'https://www.eventbrite.com/', country: 'Internacional' },
  { name: 'Run The World', careers_url: 'https://www.runtheworld.today/', country: 'Remoto' },
  { name: 'VIPKid', careers_url: 'https://t.vipkid.com/', country: 'Internacional' },
  { name: 'Teachable', careers_url: 'https://teachable.com/', country: 'Remoto' },
  { name: 'Preply', careers_url: 'https://preply.com/', country: 'Internacional' },
  { name: 'Outschool', careers_url: 'https://outschool.com/', country: 'Internacional' },
  { name: 'Chegg Tutors', careers_url: 'https://www.chegg.com/tutors', country: 'Internacional' },
  { name: 'HackerRank', careers_url: 'https://www.hackerrank.com/', country: 'Internacional' },
  { name: 'Stack Overflow Jobs', careers_url: 'https://stackoverflow.com/jobs', country: 'Internacional' },
  { name: 'Zirtual', careers_url: 'https://www.zirtual.com/', country: 'Estados Unidos' },
  { name: 'Boldly', careers_url: 'https://boldly.com/', country: 'Remoto' },
  { name: 'Time Etc', careers_url: 'https://www.timeetc.com/', country: 'Remoto' },
  { name: 'Belay Solutions', careers_url: 'https://belaysolutions.com/', country: 'Estados Unidos' },
  { name: 'Fancy Hands', careers_url: 'https://www.fancyhands.com/', country: 'Estados Unidos' },
  { name: 'Teladoc Health', careers_url: 'https://www.teladochealth.com/', country: 'Estados Unidos' },
  { name: 'MDLive', careers_url: 'https://www.mdlive.com/', country: 'Estados Unidos' },
  { name: 'Doctor On Demand', careers_url: 'https://www.doctorondemand.com/', country: 'Estados Unidos' },
  { name: 'HealthTap', careers_url: 'https://www.healthtap.com/', country: 'Estados Unidos' },
  { name: 'Care Cam', careers_url: searchFallback('Care Cam'), country: 'Estados Unidos' },
]

const PORTAL_REGIONS: { id: string; label: string; emoji: string; portals: Omit<Portal, 'enabled'>[] }[] = [
  { id: 'chile', label: 'Chile', emoji: '🇨🇱', portals: CHILE_PORTALS },
  { id: 'global', label: 'Remoto Global', emoji: '🌎', portals: GLOBAL_PORTALS },
  { id: 'us', label: 'Estados Unidos', emoji: '🇺🇸', portals: US_PORTALS },
  { id: 'spain', label: 'España', emoji: '🇪🇸', portals: SPAIN_PORTALS },
  { id: 'latam', label: 'LATAM', emoji: '🌎', portals: LATAM_PORTALS },
]

function PortalCard({
  portal,
  onToggle,
  onDelete,
}: {
  portal: Portal
  onToggle: () => void
  onDelete: () => void
}) {
  const isChile = portal.country === 'Chile'
  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
      portal.enabled
        ? 'bg-gray-800/50 border-[var(--border-alt)]'
        : 'bg-gray-900/30 border-[var(--border-default)] opacity-60'
    }`}>
      <div className="w-8 h-8 rounded-lg bg-[var(--bg-surface-alt)] flex items-center justify-center shrink-0">
        {isChile ? (
          <Flag size={16} className="text-red-400" />
        ) : (
          <Globe size={16} className="text-blue-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[var(--text-primary)] text-sm font-medium truncate">{portal.name}</p>
          {portal.country && (
            <span className={`text-xs px-1.5 py-0.5 rounded border ${
              isChile
                ? 'bg-red-900/30 text-red-400 border-red-800/50'
                : 'bg-blue-900/30 text-blue-400 border-blue-800/50'
            }`}>
              {portal.country}
            </span>
          )}
          {portal.api && (
            <span className="text-xs bg-green-900/30 text-green-400 border border-green-800/50 px-1.5 py-0.5 rounded">
              API
            </span>
          )}
        </div>
        <a
          href={portal.careers_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--text-muted)] hover:text-blue-400 transition-colors flex items-center gap-1 truncate"
        >
          <ExternalLink size={10} />
          {portal.careers_url}
        </a>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onToggle}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            portal.enabled ? 'bg-blue-600' : 'bg-gray-700'
          }`}
        >
          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
            portal.enabled ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-[var(--text-faint)] hover:text-red-400 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

export default function CareersPortals() {
  const qc = useQueryClient()
  const { t } = useTranslation()
  const [newPortal, setNewPortal] = useState({ name: '', careers_url: '', country: '' })
  const [showAdd, setShowAdd] = useState(false)
  const [saved, setSaved] = useState(false)
  const [filterCountry, setFilterCountry] = useState<string>('all')
  const [activeRegion, setActiveRegion] = useState(PORTAL_REGIONS[0].id)
  const [showMorePortals, setShowMorePortals] = useState(false)
  const [morePortalsSearch, setMorePortalsSearch] = useState('')

  const { data: config, isLoading } = useQuery<PortalsConfig>({
    queryKey: ['careers-portals'],
    queryFn: () => api.get('/portals').then(r => r.data),
  })

  const saveMut = useMutation({
    mutationFn: (data: PortalsConfig) => api.put('/portals', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['careers-portals'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-blue-400" />
      </div>
    )
  }

  const companies = config.tracked_companies || []

  const togglePortal = (idx: number) => {
    const updated = [...companies]
    updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled }
    saveMut.mutate({ ...config, tracked_companies: updated })
  }

  const deletePortal = (idx: number) => {
    const updated = companies.filter((_, i) => i !== idx)
    saveMut.mutate({ ...config, tracked_companies: updated })
  }

  const addSuggestedPortal = (portal: Omit<Portal, 'enabled'>) => {
    if (companies.some(c => c.careers_url === portal.careers_url)) return
    const updated = [...companies, { ...portal, enabled: true }]
    saveMut.mutate({ ...config, tracked_companies: updated })
  }

  const addCustomPortal = () => {
    if (!newPortal.name || !newPortal.careers_url) return
    const updated = [...companies, { ...newPortal, enabled: true }]
    saveMut.mutate({ ...config, tracked_companies: updated })
    setNewPortal({ name: '', careers_url: '', country: '' })
    setShowAdd(false)
  }

  const filtered = filterCountry === 'all'
    ? companies
    : companies.filter(c => c.country === filterCountry)

  const distinctCountries = Array.from(
    new Set(companies.map(c => c.country).filter((c): c is string => Boolean(c)))
  ).sort()
  const chileCount   = companies.filter(c => c.country === 'Chile').length
  const enabledCount = companies.filter(c => c.enabled).length

  const bulkToggle = (mode: 'all-on' | 'all-off' | 'chile-only') => {
    const updated = companies.map(c => ({
      ...c,
      enabled: mode === 'all-on' ? true
              : mode === 'all-off' ? false
              : c.country === 'Chile',
    }))
    saveMut.mutate({ ...config, tracked_companies: updated })
  }

  return (
    <div className="space-y-6">
      <PerfilTabs />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">{t('careersPortals.title')}</h2>
          <p className="text-[var(--text-tertiary)] mt-1">
            {t('careersPortals.subtitle', { enabled: enabledCount, total: companies.length, countries: distinctCountries.length, chile: chileCount })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {saved && (
            <span className="flex items-center gap-1 text-green-400 text-sm">
              <Check size={14} /> {t('careersPortals.saved')}
            </span>
          )}
          {saveMut.isPending && (
            <Loader2 size={16} className="animate-spin text-blue-400" />
          )}
          {/* Acciones masivas */}
          {companies.length > 0 && (
            <div className="flex items-center gap-1 bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg p-1">
              <button
                onClick={() => bulkToggle('all-on')}
                disabled={saveMut.isPending}
                title={t('careersPortals.bulkAllOnTitle')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-green-400 hover:bg-green-900/30 transition-colors disabled:opacity-40"
              >
                <ToggleRight size={14} /> {t('careersPortals.bulkAllOn')}
              </button>
              <button
                onClick={() => bulkToggle('chile-only')}
                disabled={saveMut.isPending}
                title={t('careersPortals.bulkChileOnlyTitle')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-red-400 hover:bg-red-900/30 transition-colors disabled:opacity-40"
              >
                🇨🇱 {t('careersPortals.bulkChileOnly')}
              </button>
              <button
                onClick={() => bulkToggle('all-off')}
                disabled={saveMut.isPending}
                title={t('careersPortals.bulkAllOffTitle')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[var(--text-tertiary)] hover:bg-gray-700 transition-colors disabled:opacity-40"
              >
                <ToggleLeft size={14} /> {t('careersPortals.bulkAllOff')}
              </button>
            </div>
          )}
          <button
            onClick={() => setShowMorePortals(!showMorePortals)}
            className="flex items-center gap-2 bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] hover:bg-gray-700 text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Search size={15} />
            {t('careersPortals.morePortals')}
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)] px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={15} />
            {t('careersPortals.addPortal')}
          </button>
        </div>
      </div>

      {/* Catálogo extendido de portales sugeridos */}
      {showMorePortals && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-alt)] rounded-xl p-5">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h3 className="text-[var(--text-primary)] font-semibold">{t('careersPortals.morePortalsTitle', { count: MORE_PORTALS.length })}</h3>
            <input
              autoFocus
              value={morePortalsSearch}
              onChange={e => setMorePortalsSearch(e.target.value)}
              placeholder={t('careersPortals.morePortalsSearchPlaceholder')}
              className="bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full sm:w-64"
            />
          </div>
          <p className="text-[var(--text-muted)] text-xs mb-4">
            {t('careersPortals.morePortalsDesc')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-96 overflow-y-auto pr-1">
            {MORE_PORTALS
              .filter(p => p.name.toLowerCase().includes(morePortalsSearch.toLowerCase()))
              .map(portal => {
                const alreadyAdded = companies.some(c => c.careers_url === portal.careers_url)
                return (
                  <button
                    key={portal.name}
                    onClick={() => !alreadyAdded && addSuggestedPortal(portal)}
                    disabled={alreadyAdded}
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-lg text-sm font-medium transition-all border text-left ${
                      alreadyAdded
                        ? 'bg-green-900/20 border-green-800/40 text-green-400 cursor-default'
                        : 'bg-gray-800/60 border-[var(--border-alt)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-alt)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{portal.name}</span>
                      {portal.country && (
                        <span className="block text-xs text-[var(--text-muted)] truncate">{portal.country}</span>
                      )}
                    </span>
                    {alreadyAdded
                      ? <Check size={13} className="shrink-0" />
                      : <Plus size={13} className="shrink-0" />
                    }
                  </button>
                )
              })}
          </div>
        </div>
      )}

      {/* Portales sugeridos por región */}
      <div className="bg-gradient-to-r from-gray-800/40 to-gray-900 border border-[var(--border-default)] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Globe size={16} className="text-blue-400" />
          <h3 className="text-[var(--text-primary)] font-semibold">{t('careersPortals.recommendedPortals')}</h3>
        </div>
        <div className="flex gap-1.5 flex-wrap mb-4">
          {PORTAL_REGIONS.map(region => (
            <button
              key={region.id}
              onClick={() => setActiveRegion(region.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeRegion === region.id
                  ? 'bg-blue-600 text-[var(--text-primary)]'
                  : 'bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {region.emoji} {t(`careersPortals.regions.${region.id}`)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PORTAL_REGIONS.find(r => r.id === activeRegion)!.portals.map(portal => {
            const alreadyAdded = companies.some(c => c.careers_url === portal.careers_url)
            return (
              <button
                key={portal.careers_url}
                onClick={() => !alreadyAdded && addSuggestedPortal(portal)}
                disabled={alreadyAdded}
                className={`flex items-center justify-between gap-2 p-2.5 rounded-lg text-sm font-medium transition-all border ${
                  alreadyAdded
                    ? 'bg-green-900/20 border-green-800/40 text-green-400 cursor-default'
                    : 'bg-gray-800/60 border-[var(--border-alt)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-alt)] hover:text-[var(--text-primary)]'
                }`}
              >
                <span className="truncate">{portal.name}</span>
                {alreadyAdded
                  ? <Check size={13} className="shrink-0" />
                  : <Plus size={13} className="shrink-0" />
                }
              </button>
            )
          })}
        </div>
      </div>

      {/* Add custom portal */}
      {showAdd && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-alt)] rounded-xl p-5">
          <h3 className="text-[var(--text-primary)] font-semibold mb-4">{t('careersPortals.addCustomTitle')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              value={newPortal.name}
              onChange={e => setNewPortal(p => ({ ...p, name: e.target.value }))}
              placeholder={t('careersPortals.namePlaceholder')}
              className="bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <input
              value={newPortal.careers_url}
              onChange={e => setNewPortal(p => ({ ...p, careers_url: e.target.value }))}
              placeholder={t('careersPortals.urlPlaceholder')}
              className="bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <input
              value={newPortal.country}
              onChange={e => setNewPortal(p => ({ ...p, country: e.target.value }))}
              placeholder={t('careersPortals.countryPlaceholder')}
              className="bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={addCustomPortal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors"
            >
              <Save size={14} /> {t('careersPortals.add')}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-[var(--bg-surface-alt)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-lg text-sm transition-colors"
            >
              {t('careersPortals.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterCountry('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filterCountry === 'all'
              ? 'bg-blue-600 text-[var(--text-primary)]'
              : 'bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
          }`}
        >
          {t('careersPortals.filterAll')}
        </button>
        {distinctCountries.map(country => (
          <button
            key={country}
            onClick={() => setFilterCountry(country)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterCountry === country
                ? 'bg-blue-600 text-[var(--text-primary)]'
                : 'bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {country}
          </button>
        ))}
      </div>

      {/* Portal list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-8 text-center text-[var(--text-muted)]">
            <Globe size={32} className="mx-auto mb-3 text-gray-700" />
            <p>{t('careersPortals.emptyState1')}</p>
            <p className="text-sm mt-1">{t('careersPortals.emptyState2')}</p>
          </div>
        ) : (
          filtered.map((portal) => {
            const realIdx = companies.findIndex(c => c.careers_url === portal.careers_url)
            return (
              <PortalCard
                key={portal.careers_url}
                portal={portal}
                onToggle={() => togglePortal(realIdx)}
                onDelete={() => deletePortal(realIdx)}
              />
            )
          })
        )}
      </div>

      {/* Filtros de keywords */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
        <h3 className="text-[var(--text-primary)] font-semibold mb-3 flex items-center gap-2">
          <Search size={16} className="text-blue-400" />
          {t('careersPortals.searchFilters.title')}
        </h3>
        <p className="text-[var(--text-tertiary)] text-sm mb-4">
          {t('careersPortals.searchFilters.desc')}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-green-400 font-medium uppercase tracking-wider mb-2 block">
              {t('careersPortals.searchFilters.positiveLabel', { count: config.title_filter?.positive?.length ?? 0 })}
            </label>
            <div className="flex flex-wrap gap-1.5 p-3 bg-gray-800/50 rounded-lg min-h-[60px]">
              {(config.title_filter?.positive ?? []).slice(0, 20).map(kw => (
                <span key={kw} className="text-xs bg-green-900/30 text-green-400 border border-green-800/40 px-2 py-0.5 rounded-full">
                  {kw}
                </span>
              ))}
              {(config.title_filter?.positive?.length ?? 0) > 20 && (
                <span className="text-xs text-[var(--text-muted)]">{t('careersPortals.searchFilters.more', { count: (config.title_filter?.positive?.length ?? 0) - 20 })}</span>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs text-red-400 font-medium uppercase tracking-wider mb-2 block">
              {t('careersPortals.searchFilters.negativeLabel', { count: config.title_filter?.negative?.length ?? 0 })}
            </label>
            <div className="flex flex-wrap gap-1.5 p-3 bg-gray-800/50 rounded-lg min-h-[60px]">
              {(config.title_filter?.negative ?? []).slice(0, 20).map(kw => (
                <span key={kw} className="text-xs bg-red-900/30 text-red-400 border border-red-800/40 px-2 py-0.5 rounded-full">
                  {kw}
                </span>
              ))}
              {(config.title_filter?.negative?.length ?? 0) > 20 && (
                <span className="text-xs text-[var(--text-muted)]">{t('careersPortals.searchFilters.more', { count: (config.title_filter?.negative?.length ?? 0) - 20 })}</span>
              )}
            </div>
          </div>
        </div>
        <p className="text-xs text-[var(--text-faint)] mt-3">
          {t('careersPortals.searchFilters.editNote')} <code className="text-[var(--text-tertiary)]">{t('sidebar.nav.busqueda')}</code>.
        </p>
      </div>
    </div>
  )
}
