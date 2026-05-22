const demoCampaigns = [
  {
    id: '8929c055-0415-4948-89c3-639ca3c104a0',
    nombre: 'Campana Principal',
  },
]

export const demoClasses = [
  {
    id: 'demo-class-cronista-umbral',
    nombre: 'Cronista del Umbral',
    idiomaCodigo: 'es',
    fuente: 'WikiCodex Demo',
    edicion: 'wikicodex',
    categoriaCatalogo: 'wikicodex',
    resumen:
      'Eruditos de frontera que convierten recuerdos, rumores y juramentos en magia util para explorar mundos imposibles.',
    descripcion:
      'Los Cronistas del Umbral viajan alli donde una historia esta a punto de romperse. Sus poderes nacen de registrar nombres verdaderos, pactos antiguos y escenas que otros olvidarian. En partida funcionan como apoyo tactico, exploradores sociales y especialistas en informacion.',
    icono: 'BookOpen',
    dadoGolpeCaras: 8,
    salvaciones: ['inteligencia', 'sabiduria'],
    competencias: {
      armaduras: ['ligeras'],
      armas: ['simples', 'ballesta ligera'],
      habilidades: ['Investigacion', 'Historia', 'Perspicacia'],
      herramientas: ['kit de caligrafia'],
    },
    equipoInicial: [
      'Cuaderno sellado',
      'pluma de tinta gris',
      'ballesta ligera',
      'armadura de cuero',
    ],
    tabla: [
      {
        titulo: 'Recursos de Cronista',
        etiquetas: ['Ecos', 'Marcas narrativas'],
        filas: Array.from({ length: 20 }, (_item, index) => [
          Math.max(2, Math.ceil((index + 1) / 2)),
          index + 1 < 5 ? 1 : index + 1 < 11 ? 2 : index + 1 < 17 ? 3 : 4,
        ]),
      },
    ],
    rasgos: [
      {
        id: 'demo-class-cronista-rasgo-1',
        nivel: 1,
        nombre: 'Eco Registrado',
        descripcion:
          'Cuando una criatura que puedas ver falle una prueba de habilidad, puedes gastar un Eco para permitirle repetir la tirada. Debe usar el nuevo resultado.',
      },
      {
        id: 'demo-class-cronista-rasgo-2',
        nivel: 2,
        nombre: 'Margen de la Historia',
        descripcion:
          'Puedes crear una nota arcana sobre una criatura, objeto o lugar. Hasta tu siguiente descanso largo, tienes ventaja en la primera prueba de Investigacion o Perspicacia relacionada con esa nota.',
      },
      {
        id: 'demo-class-cronista-rasgo-6',
        nivel: 6,
        nombre: 'Correccion Imposible',
        descripcion:
          'Una vez por descanso corto, cuando un aliado falle una salvacion, puedes sumar tu bonificador de competencia al resultado si puedes justificar como tu archivo anticipo ese peligro.',
      },
    ],
    subclases: [
      {
        id: 'demo-subclass-cartografo-ecos',
        nombre: 'Cartografo de Ecos',
        resumen:
          'Especialista en rutas, portales y lugares que recuerdan haber sido otros.',
        descripcion:
          'Los Cartografos de Ecos dibujan mapas de caminos que todavia no existen del todo.',
        rasgos: [
          {
            id: 'demo-subclass-cartografo-3',
            nivel: 3,
            nombre: 'Mapa que Respira',
            descripcion:
              'Puedes marcar un punto que hayas visitado hoy. Mientras este marcado, conoces la direccion aproximada hacia el y detectas si cambia de plano, nombre o forma.',
          },
        ],
      },
      {
        id: 'demo-subclass-escriba-juramentos',
        nombre: 'Escriba de Juramentos',
        resumen:
          'Convierte promesas, contratos y deudas en proteccion o castigo.',
        descripcion:
          'Los Escribas de Juramentos escuchan las palabras que atan a las personas y las hacen pesar en el mundo.',
        rasgos: [
          {
            id: 'demo-subclass-juramentos-3',
            nivel: 3,
            nombre: 'Clausula Vinculante',
            descripcion:
              'Cuando una criatura rompa un acuerdo verbal hecho ante ti, puedes imponer desventaja a su siguiente ataque o prueba antes del final de su turno.',
          },
        ],
      },
    ],
    campanas: demoCampaigns,
    creadorSistema: true,
    puedeEditar: false,
    puedeBorrar: false,
  },
  {
    id: 'demo-class-vigilante-astro',
    nombre: 'Vigilante del Astro Hueco',
    idiomaCodigo: 'es',
    fuente: 'WikiCodex Demo',
    edicion: 'wikicodex',
    categoriaCatalogo: 'wikicodex',
    resumen:
      'Guardianes marcados por constelaciones vacias que mezclan defensa, movilidad y presagios de combate.',
    descripcion:
      'Los Vigilantes del Astro Hueco aprenden a leer los silencios del cielo. No adivinan el futuro completo, pero saben donde caera el golpe, que puerta conviene cerrar y cuando una sombra esta a punto de despertar.',
    icono: 'Shield',
    dadoGolpeCaras: 10,
    salvaciones: ['fuerza', 'carisma'],
    competencias: {
      armaduras: ['ligeras', 'medias', 'escudos'],
      armas: ['simples', 'marciales'],
      habilidades: ['Atletismo', 'Percepcion', 'Supervivencia'],
    },
    equipoInicial: [
      'lanza ceremonial',
      'escudo ennegrecido',
      'cota de escamas',
      'fragmento de meteorito',
    ],
    tabla: [
      {
        titulo: 'Luz Astral',
        etiquetas: ['Dados de presagio', 'Impulso'],
        filas: Array.from({ length: 20 }, (_item, index) => [
          Math.max(1, Math.ceil((index + 1) / 3)),
          index + 1 < 5 ? '+10 ft' : index + 1 < 13 ? '+15 ft' : '+20 ft',
        ]),
      },
    ],
    rasgos: [
      {
        id: 'demo-class-vigilante-rasgo-1',
        nivel: 1,
        nombre: 'Centinela de Luz Fria',
        descripcion:
          'Mientras lleves escudo o arma marcial, puedes usar una reaccion para reducir el dano recibido por un aliado cercano en una cantidad igual a tu bonificador de competencia.',
      },
      {
        id: 'demo-class-vigilante-rasgo-3',
        nivel: 3,
        nombre: 'Presagio de Impacto',
        descripcion:
          'Al inicio del combate tira un d20 y guarda el resultado. Antes de que una criatura que veas tire un ataque, puedes sustituir su tirada por ese presagio.',
      },
      {
        id: 'demo-class-vigilante-rasgo-10',
        nivel: 10,
        nombre: 'Orbita Defensiva',
        descripcion:
          'Cuando te mueves al menos 15 pies en tu turno, hasta el inicio de tu siguiente turno obtienes un bonificador de +2 a la CA contra ataques de oportunidad.',
      },
    ],
    subclases: [
      {
        id: 'demo-subclass-lanza-cometa',
        nombre: 'Lanza del Cometa',
        resumen:
          'Una senda agresiva centrada en cargas, empujones y duelos rapidos.',
        descripcion:
          'Los Lanza del Cometa convierten cada avance en una amenaza visible desde lejos.',
        rasgos: [
          {
            id: 'demo-subclass-cometa-3',
            nivel: 3,
            nombre: 'Caida Incandescente',
            descripcion:
              'Si impactas despues de moverte al menos 20 pies en linea recta, puedes infligir dano radiante adicional igual a tu bonificador de competencia.',
          },
        ],
      },
    ],
    campanas: demoCampaigns,
    creadorSistema: true,
    puedeEditar: false,
    puedeBorrar: false,
  },
]

export const demoFeats = [
  {
    id: 'demo-feat-pulso-heroico',
    nombre: 'Pulso Heroico',
    idiomaCodigo: 'es',
    fuente: 'WikiCodex Demo',
    edicion: 'wikicodex',
    categoria: 'Combate',
    resumen:
      'Una reserva breve de energia para mantenerse en pie cuando la escena se complica.',
    descripcion:
      'Cuando quedas por debajo de la mitad de tus puntos de golpe, puedes ganar puntos de golpe temporales iguales a tu nivel + tu bonificador de competencia. Una vez uses esta dote, debes terminar un descanso largo para volver a hacerlo.',
    prerrequisitos: [{ texto: 'Nivel 4 o superior' }],
    beneficios: [
      {
        nombre: 'Resistencia dramatica',
        descripcion:
          'Ganas una reaccion defensiva que puede cambiar el ritmo de una escena peligrosa.',
      },
    ],
    datosFuente: {},
    creadorSistema: true,
    puedeEditar: false,
    puedeBorrar: false,
  },
  {
    id: 'demo-feat-duelista-de-sombras',
    nombre: 'Duelista de Sombras',
    idiomaCodigo: 'es',
    fuente: 'WikiCodex Demo',
    edicion: 'wikicodex',
    categoria: 'Combate',
    resumen:
      'Tecnicas de posicionamiento para personajes que pelean desde penumbra, humo o cobertura.',
    descripcion:
      'Una vez por turno, si estas en luz tenue, oscuridad o cobertura parcial, puedes sumar +1 al dano de un ataque con arma o teletransportarte 5 pies a un espacio visible sin provocar ataques de oportunidad.',
    prerrequisitos: [{ texto: 'Competencia con armas marciales o Sigilo' }],
    beneficios: [
      {
        nombre: 'Paso evasivo',
        descripcion:
          'Aprovechas sombras y obstaculos pequenos para recolocarte sin romper el flujo del combate.',
      },
    ],
    datosFuente: {},
    creadorSistema: true,
    puedeEditar: false,
    puedeBorrar: false,
  },
  {
    id: 'demo-feat-lector-de-presagios',
    nombre: 'Lector de Presagios',
    idiomaCodigo: 'es',
    fuente: 'WikiCodex Demo',
    edicion: 'wikicodex',
    categoria: 'Exploracion',
    resumen:
      'Interpretas marcas, coincidencias y signos para anticipar riesgos narrativos.',
    descripcion:
      'Tras estudiar una escena durante 1 minuto, puedes preguntar al director por una amenaza probable, una ruta segura o una consecuencia oculta. Obtienes ventaja en la primera prueba relacionada con la respuesta.',
    prerrequisitos: [{ texto: 'Inteligencia o Sabiduria 13+' }],
    beneficios: [
      {
        nombre: 'Pregunta de escena',
        descripcion:
          'Transforma informacion ambiental en una ventaja concreta para el grupo.',
      },
    ],
    datosFuente: {},
    creadorSistema: true,
    puedeEditar: false,
    puedeBorrar: false,
  },
  {
    id: 'demo-feat-manitas-arcano',
    nombre: 'Manitas Arcano',
    idiomaCodigo: 'es',
    fuente: 'WikiCodex Demo',
    edicion: 'wikicodex',
    categoria: 'Utilidad',
    resumen:
      'Pequenas reparaciones, ajustes y trucos magicos para resolver problemas practicos.',
    descripcion:
      'Aprendes un truco de tu eleccion de la lista de artificer o mago. Ademas, tienes ventaja en pruebas para reparar, sabotear o adaptar mecanismos sencillos cuando dispones de herramientas apropiadas.',
    prerrequisitos: [{ texto: 'Competencia con una herramienta artesanal' }],
    beneficios: [
      {
        nombre: 'Truco tecnico',
        descripcion:
          'Combina oficio y magia menor para abrir opciones fuera del combate.',
      },
    ],
    datosFuente: {},
    creadorSistema: true,
    puedeEditar: false,
    puedeBorrar: false,
  },
  {
    id: 'demo-feat-voz-de-mando',
    nombre: 'Voz de Mando',
    idiomaCodigo: 'es',
    fuente: 'WikiCodex Demo',
    edicion: 'wikicodex',
    categoria: 'Social',
    resumen:
      'Tu presencia ordena la escena y ayuda a aliados a actuar con decision.',
    descripcion:
      'Como accion adicional, eliges un aliado que pueda oirte a 30 pies. Ese aliado puede moverse 10 pies sin provocar ataques de oportunidad o ganar ventaja en su siguiente prueba de Carisma antes del final de su turno.',
    prerrequisitos: [{ texto: 'Carisma 13+' }],
    beneficios: [
      {
        nombre: 'Orden clara',
        descripcion:
          'Aporta movilidad tactica o empuje social sin sustituir la accion principal del personaje.',
      },
    ],
    datosFuente: {},
    creadorSistema: true,
    puedeEditar: false,
    puedeBorrar: false,
  },
]
