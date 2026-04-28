import { CategoryMenuItem } from "models/Navigation.model";

const categoriesMegaMenu: CategoryMenuItem[] = [
  {
    title: "Fashion",
    child: [
      {
        title: "Men's Fashion",
        child: [
          { title: "T-Shirt", url: "#", icon: "Shirt" },
          { title: "Formal Shirt", url: "#", icon: "UserTie" },
          { title: "Shirt", url: "#", icon: "Shirt" },
          { title: "Shoes", url: "#", icon: "Shoe" },
          { title: "Jeans Pant", url: "#", icon: "Shirt" },
          { title: "Gabardine Pant", url: "#", icon: "Shirt" },
          { title: "Formal Pant", url: "#", icon: "Shirt" },
          { title: "Sunglass", url: "#", icon: "Vest" },
          { title: "Formal Shoes", url: "#", icon: "Shoe" },
          { title: "Lungi", url: "#", icon: "Vest" },
          { title: "Tank", url: "#", icon: "Shoe" },
          { title: "Jacket", url: "#", icon: "Vest" }
        ]
      },
      {
        title: "Women's Fashion",
        child: [
          { title: "Clothing", url: "#", icon: "UserProfile" },
          { title: "Shoes", url: "#", icon: "Shoe" },
          { title: "Jewelry", url: "#", icon: "Accounts" },
          { title: "Watches", url: "#", icon: "AdminEcommerce" },
          { title: "Hand Bags", url: "#", icon: "Calender" },
          { title: "Accessories", url: "#", icon: "Chat" },
          { title: "Makeup", url: "#", icon: "Customers" },
          { title: "Clothing", url: "#", icon: "Dashboard" },
          { title: "Shoes", url: "#", icon: "DataTable" },
          { title: "Jewelry", url: "#", icon: "Ecommerce" },
          { title: "Watches", url: "#", icon: "ElementHub" },
          { title: "Hand Bags", url: "#", icon: "Invoice" }
        ]
      },

      {
        title: "Girls' Fashion",
        child: [
          { title: "Clothing", url: "#", icon: "Logout" },
          { title: "Shoes", url: "#", icon: "Order" },
          { title: "Jewelry", url: "#", icon: "Pages" },
          { title: "Watches", url: "#", icon: "Pricing" },
          { title: "Hand Bags", url: "#", icon: "Products" },
          { title: "Gadget", url: "#", icon: "ProjectChart" },
          { title: "Clothing", url: "#", icon: "Refund" },
          { title: "Watches", url: "#", icon: "Review" },
          { title: "Shoes", url: "#", icon: "Seller" },
          { title: "Gadget", url: "#", icon: "Session" },
          { title: "Jewelry", url: "#", icon: "Settings" },
          { title: "Hand Bags", url: "#", icon: "TodoList" }
        ]
      }
    ]
  },
  {
    title: "Electronics",
    child: [
      {
        title: "Accessories & Supplies",
        child: [
          {
            url: "#",
            title: "Audio & Video Accessories",
            img: "/assets/images/products/bgearphone.png"
          },
          {
            url: "#",
            title: "Cables",
            img: "/assets/images/products/Electronics/35.beatsbluetoothearpohones.png"
          },
          {
            url: "#",
            title: "Microphones",
            img: "/assets/images/products/Electronics/33.beatswirelessearphones.png"
          },
          {
            url: "#",
            title: "Cord Management",
            img: "/assets/images/products/Electronics/2.COSOR1.png"
          },
          {
            url: "#",
            title: "Power Protection",
            img: "/assets/images/products/Electronics/3.PanasonicCharge.png"
          },
          {
            url: "#",
            title: "Cell Phone Accessories",
            img: "/assets/images/products/Electronics/32.iphone7.png"
          }
        ]
      },
      {
        title: "Power Accessories",
        child: [
          {
            url: "#",
            title: "AC Adapters",
            img: "/assets/images/products/Electronics/5.AtechCam1080p.png"
          },
          {
            url: "#",
            title: "Isolation Transformers",
            img: "/assets/images/products/Electronics/6.Sonya9.png"
          },
          {
            url: "#",
            title: "Line Conditioners",
            img: "/assets/images/products/Electronics/7.beatsw3.png"
          },
          {
            url: "#",
            title: "PDUs",
            img: "/assets/images/products/Electronics/8.BenQ2020.png"
          },
          {
            url: "#",
            title: "Power Converters",
            img: "/assets/images/products/Electronics/10.SonyPS4.png"
          }
        ]
      },
      {
        title: "Video Game Consoles & Accessories",
        child: [
          {
            url: "#",
            title: "PlayStation 4",
            img: "/assets/images/products/Electronics/12.SonyBGB.png"
          },
          {
            url: "#",
            title: "PlayStation 3",
            img: "/assets/images/products/Electronics/13.LGProducts.png"
          },
          {
            url: "#",
            title: "Xbox One",
            img: "/assets/images/products/Electronics/14.Panasonic2019.png"
          },
          {
            url: "#",
            title: "Nintendo Switch",
            img: "/assets/images/products/Electronics/15.DuneHD.png"
          },
          {
            url: "#",
            title: "Sony PSP",
            img: "/assets/images/products/Electronics/16.SonyCCTV.png"
          }
        ]
      }
    ]
  },
  {
    title: "Books",
    child: [
      {
        title: "Arts & Photography",
        child: [
          { title: "Architecture", url: "#" },
          { title: "Business of Art", url: "#" },
          { title: "History & Criticism", url: "#" },
          { title: "Individual Artists", url: "#" },
          { title: "Photography & Video", url: "#" },
          { title: "Study & Teaching", url: "#" }
        ]
      },
      {
        title: "Biographies & Memoirs",
        child: [
          { title: "Arts & Literature", url: "#" },
          { title: "Leaders & Notable People", url: "#" },
          { title: "Professionals & Academics", url: "#" },
          { title: "Sports & Outdoors", url: "#" },
          { title: "True Crime", url: "#" }
        ]
      },
      {
        title: "Children's Books",
        child: [
          { title: "Action & Adventure", url: "#" },
          { title: "Animals", url: "#" },
          { title: "Biographies", url: "#" },
          { title: "Geography & Cultures", url: "#" },
          { title: "Holidays & Celebrations", url: "#" }
        ]
      }
    ]
  },
  {
    title: "Sports and Outdoors",
    child: [
      {
        title: "Outdoor Recreation",
        child: [
          { title: "Accessories", url: "#" },
          { title: "Camping & Hiking", url: "#" },
          { title: "Climbing", url: "#" },
          { title: "Cycling", url: "#" },
          { title: "Paintball", url: "#" },
          { title: "Water Sports", url: "#" }
        ]
      },
      {
        title: "Exercise & Fitness",
        child: [
          { title: "Balance Trainers", url: "#" },
          { title: "Cardio Training", url: "#" },
          { title: "Fitness Technology", url: "#" },
          { title: "Footwear", url: "#" },
          { title: "Running", url: "#" }
        ]
      },
      {
        title: "Sports Medicine",
        child: [
          { title: "Athletic Tape & Supplies", url: "#" },
          { title: "First Aid Kits", url: "#" },
          { title: "Padding Supplies", url: "#" },
          { title: "Mouthguards", url: "#" }
        ]
      }
    ]
  },
  {
    title: "Software",
    child: [
      {
        title: "Accounting & Finance",
        child: [
          { title: "Business Accounting", url: "#" },
          { title: "Check Printing", url: "#" },
          { title: "Personal Finance", url: "#" },
          { title: "Tax Preparation", url: "#" }
        ]
      },
      {
        title: "Antivirus & Security",
        child: [
          { title: "Antivirus", url: "#" },
          { title: "Internet Security Suites", url: "#" },
          { title: "Parental Control", url: "#" }
        ]
      },
      {
        title: "Business & Office",
        child: [
          { title: "Communication", url: "#" },
          { title: "Contact Management", url: "#" },
          { title: "Database Management", url: "#" },
          { title: "Document Management", url: "#" },
          { title: "Office Suites", url: "#" }
        ]
      }
    ]
  },
  {
    title: "Toys and Games",
    child: [
      {
        title: "Arts & Crafts",
        child: [
          { title: "Adhesives", url: "#" },
          { title: "Aprons & Smocks", url: "#" },
          { title: "Clay & Dough", url: "#" },
          { title: "Craft Kits", url: "#" }
        ]
      },
      {
        title: "Baby & Toddler Toys",
        child: [
          { title: "Activity Centers", url: "#" },
          { title: "Balls", url: "#" },
          { title: "Bath Toys", url: "#" },
          { title: "Car Seat & Stroller Toys", url: "#" }
        ]
      }
    ]
  }
];

export default categoriesMegaMenu;
