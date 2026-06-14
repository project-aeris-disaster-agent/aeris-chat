export type PhMajorCity = {
  name: string;
  region: string;
  lat: number;
  lng: number;
};

/** Major Philippine cities for typhoon track proximity analysis. */
export const PH_MAJOR_CITIES: PhMajorCity[] = [
  { name: "Manila", region: "NCR", lat: 14.5995, lng: 120.9842 },
  { name: "Quezon City", region: "NCR", lat: 14.676, lng: 121.0437 },
  { name: "Marikina", region: "NCR", lat: 14.6507, lng: 121.1029 },
  { name: "Pasig", region: "NCR", lat: 14.5764, lng: 121.0851 },
  { name: "Makati", region: "NCR", lat: 14.5547, lng: 121.0244 },
  { name: "Taguig", region: "NCR", lat: 14.5176, lng: 121.0509 },
  { name: "Caloocan", region: "NCR", lat: 14.6488, lng: 120.9839 },
  { name: "Antipolo", region: "Rizal", lat: 14.6255, lng: 121.1245 },
  { name: "Baguio", region: "Benguet", lat: 16.4023, lng: 120.596 },
  { name: "Angeles", region: "Pampanga", lat: 15.145, lng: 120.5847 },
  { name: "Olongapo", region: "Zambales", lat: 14.8292, lng: 120.2828 },
  { name: "Batangas City", region: "Batangas", lat: 13.7565, lng: 121.0583 },
  { name: "Lucena", region: "Quezon", lat: 13.9319, lng: 121.617 },
  { name: "Legazpi", region: "Albay", lat: 13.139, lng: 123.744 },
  { name: "Naga", region: "Camarines Sur", lat: 13.6192, lng: 123.1814 },
  { name: "Daet", region: "Camarines Norte", lat: 14.1122, lng: 122.9553 },
  { name: "Tuguegarao", region: "Cagayan", lat: 17.6138, lng: 121.7269 },
  { name: "Laoag", region: "Ilocos Norte", lat: 18.1978, lng: 120.5937 },
  { name: "Vigan", region: "Ilocos Sur", lat: 17.5748, lng: 120.3869 },
  { name: "Dagupan", region: "Pangasinan", lat: 16.0439, lng: 120.3328 },
  { name: "San Fernando", region: "La Union", lat: 16.6159, lng: 120.3167 },
  { name: "Puerto Princesa", region: "Palawan", lat: 9.7392, lng: 118.7353 },
  { name: "Iloilo City", region: "Iloilo", lat: 10.7202, lng: 122.5621 },
  { name: "Bacolod", region: "Negros Occidental", lat: 10.6407, lng: 122.9689 },
  { name: "Cebu City", region: "Cebu", lat: 10.3157, lng: 123.8854 },
  { name: "Tacloban", region: "Leyte", lat: 11.242, lng: 125.0036 },
  { name: "Catbalogan", region: "Samar", lat: 11.7753, lng: 124.8861 },
  { name: "Borongan", region: "Eastern Samar", lat: 11.6084, lng: 125.4319 },
  { name: "Dumaguete", region: "Negros Oriental", lat: 9.3068, lng: 123.3054 },
  { name: "Tagbilaran", region: "Bohol", lat: 9.647, lng: 123.853 },
  { name: "Cagayan de Oro", region: "Misamis Oriental", lat: 8.4542, lng: 124.6319 },
  { name: "Butuan", region: "Agusan del Norte", lat: 8.9475, lng: 125.5406 },
  { name: "Surigao City", region: "Surigao del Norte", lat: 9.7853, lng: 125.4958 },
  { name: "Davao City", region: "Davao del Sur", lat: 7.1907, lng: 125.4553 },
  { name: "General Santos", region: "South Cotabato", lat: 6.1164, lng: 125.1716 },
  { name: "Zamboanga City", region: "Zamboanga del Sur", lat: 6.9214, lng: 122.079 },
  { name: "Cotabato City", region: "Maguindanao", lat: 7.2047, lng: 124.2472 },
  { name: "Iligan", region: "Lanao del Norte", lat: 8.228, lng: 124.2452 },
  { name: "Dipolog", region: "Zamboanga del Norte", lat: 8.5881, lng: 123.3419 },
  { name: "Pagadian", region: "Zamboanga del Sur", lat: 7.8257, lng: 123.437 },
];
