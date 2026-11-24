const groceryNavigations = [
  {
    icon: "Carrot",
    title: "Vegetables",
    href: "/pretraga?category=clothes"
  },
  {
    icon: "Apple",
    title: "Fruits & Vegetables",
    href: "/pretraga?category=clothes",
    child: [
      {
        title: "Fresh Frutes",
        href: "/pretraga?category=clothes",
        child: [
          { title: "Pears, apples, quinces", href: "/pretraga?category=clothes" },
          { title: "Peaches, plums, apricots", href: "/pretraga?category=clothes" },
          { title: "Grapes", href: "/pretraga?category=clothes" }
        ]
      },
      {
        title: "Fresh Vegetables",
        href: "/pretraga?category=clothes",
        child: [
          { title: "Onion", href: "/pretraga?category=clothes" },
          { title: "Potato", href: "/pretraga?category=clothes" },
          { title: "Vegetable Pack", href: "/pretraga?category=clothes" }
        ]
      }
    ]
  },
  {
    icon: "Milk",
    title: "Dariry & Eggs",
    href: "/pretraga?category=clothes"
  },
  {
    icon: "Breakfast",
    title: "Breakfast",
    href: "/pretraga?category=clothes"
  },
  {
    icon: "Yogurt",
    title: "Frozen",
    href: "/pretraga?category=clothes"
  },
  {
    icon: "Honey",
    title: "Organic",
    href: "/pretraga?category=clothes"
  },
  {
    icon: "Beer",
    title: "Canned Food",
    href: "/pretraga?category=clothes"
  },
  {
    icon: "Snack",
    title: "Coffee & Snacks",
    href: "/pretraga?category=clothes"
  },
  {
    icon: "Bottle",
    title: "Sauces & Jems",
    href: "/pretraga?category=clothes"
  }
];

export default groceryNavigations;
