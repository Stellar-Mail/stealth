import type { Persona } from "../types/persona";

export const defaultPersonas: Persona[] = [
  {
    id: "persona-01",
    name: "Amara Osei",
    email: "amara.osei@stealth.demo",
    stellarAddress: "GDQJUTQYK2MQX2CQSCQODRFJZBKOSW3X5X3SR3MY4PXBX7TNLHZE5DC",
    avatar: "AO",
  },
  {
    id: "persona-02",
    name: "Lena Kovacs",
    email: "lena.kovacs@stealth.demo",
    stellarAddress: "GBHKPRIV4SVQOIKFA7FGXXUJYOQTBQOS2ZEDCBFKN3NKPXBFVHZE3AB",
    avatar: "LK",
  },
  {
    id: "persona-03",
    name: "Rafael Matos",
    email: "rafael.matos@stealth.demo",
    stellarAddress: "GCXVLUITYNET6NRNFZE4BTQ6YZOSV3UDFZQBNFNKPXBX7TNLHZE5FA",
    avatar: "RM",
  },
  {
    id: "persona-04",
    name: "Suki Tanaka",
    email: "suki.tanaka@stealth.demo",
    stellarAddress: "GDNZQJUTQYK2MQX2CQSCQODRFJZBKOSW3X5X3SR3MY4PXBX7TNLHZE5",
    avatar: "ST",
  },
  {
    id: "persona-05",
    name: "Olusegun Abiodun",
    email: "olusegun.abiodun@stealth.demo",
    stellarAddress: "GBXVLUITYNET6NRNFZE4BTQ6YZOSV3UDFZQBNFNKPXBX7TNLHZE5AB",
    avatar: "OA",
  },
  {
    id: "persona-06",
    name: "Marta Jiménez",
    email: "marta.jimenez@stealth.demo",
    stellarAddress: "GCNZQJUTQYK2MQX2CQSCQODRFJZBKOSW3X5X3SR3MY4PXBX7TNLHZE4",
    avatar: "MJ",
  },
  {
    id: "persona-07",
    name: "Declan O'Brien",
    email: "declan.obrien@stealth.demo",
    stellarAddress: "GDXVLUITYNET6NRNFZE4BTQ6YZOSV3UDFZQBNFNKPXBX7TNLHZE5CC",
    avatar: "DO",
  },
  {
    id: "persona-08",
    name: "Priya Nair",
    email: "priya.nair@stealth.demo",
    stellarAddress: "GBNZQJUTQYK2MQX2CQSCQODRFJZBKOSW3X5X3SR3MY4PXBX7TNLHZE3",
    avatar: "PN",
  },
  {
    id: "persona-09",
    name: "Yuki Hashimoto",
    email: "yuki.hashimoto@stealth.demo",
    stellarAddress: "GCXVLUITYNET6NRNFZE4BTQ6YZOSV3UDFZQBNFNKPXBX7TNLHZE5DC",
    avatar: "YH",
  },
  {
    id: "persona-10",
    name: "Fatima Al-Rashid",
    email: "fatima.alrashid@stealth.demo",
    stellarAddress: "GDNZQJUTQYK2MQX2CQSCQODRFJZBKOSW3X5X3SR3MY4PXBX7TNLHZE6",
    avatar: "FA",
  },
  {
    id: "persona-11",
    name: "Björn Lindqvist",
    email: "bjorn.lindqvist@stealth.demo",
    stellarAddress: "GBXVLUITYNET6NRNFZE4BTQ6YZOSV3UDFZQBNFNKPXBX7TNLHZE5BB",
    avatar: "BL",
  },
  {
    id: "persona-12",
    name: "Chidi Eze",
    email: "chidi.eze@stealth.demo",
    stellarAddress: "GCNZQJUTQYK2MQX2CQSCQODRFJZBKOSW3X5X3SR3MY4PXBX7TNLHZE5",
    avatar: "CE",
  },
];

export const PERSONAS_BY_ID: Record<string, Persona> = Object.fromEntries(
  defaultPersonas.map((p) => [p.id, p]),
);
