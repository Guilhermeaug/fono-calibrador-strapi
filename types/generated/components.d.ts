import type { Schema, Attribute } from '@strapi/strapi';

export interface GeneralResultados extends Schema.Component {
  collectionName: 'components_general_resultados';
  info: {
    displayName: 'Resultados';
    icon: 'cup';
    description: '';
  };
  attributes: {
    duration: Attribute.Integer & Attribute.DefaultTo<0>;
    audios: Attribute.Component<'general.resultado-do-audio', true>;
  };
}

export interface GeneralResultadoDoAudio extends Schema.Component {
  collectionName: 'components_general_resultado_do_audios';
  info: {
    displayName: 'ResultadoDoAudio';
    icon: 'brush';
    description: '';
  };
  attributes: {
    identifier: Attribute.String & Attribute.Required;
    answer: Attribute.Integer &
      Attribute.Required &
      Attribute.SetMinMax<
        {
          min: 0;
          max: 100;
        },
        number
      >;
    duration: Attribute.Integer & Attribute.DefaultTo<0>;
    numberOfAttempts: Attribute.Integer;
  };
}

export interface GeneralAudio extends Schema.Component {
  collectionName: 'components_general_audio';
  info: {
    displayName: 'Audio';
    icon: 'volumeUp';
    description: '';
  };
  attributes: {
    file: Attribute.Media<'audios'> & Attribute.Required;
    roughness: Attribute.JSON &
      Attribute.CustomField<
        'plugin::multi-select.multi-select',
        [
          '0',
          '1',
          '2',
          '3',
          '4',
          '5',
          '6',
          '7',
          '8',
          '9',
          '10',
          '11',
          '12',
          '13',
          '14',
          '15',
          '16',
          '17',
          '18',
          '19',
          '20',
          '21',
          '22',
          '23',
          '24',
          '25',
          '26',
          '27',
          '28',
          '29',
          '30',
          '31',
          '32',
          '33',
          '34',
          '35',
          '36',
          '37',
          '38',
          '39',
          '40',
          '41',
          '42',
          '43',
          '44',
          '45',
          '46',
          '47',
          '48',
          '49',
          '50',
          '51',
          '52',
          '53',
          '54',
          '55',
          '56',
          '57',
          '58',
          '59',
          '60',
          '61',
          '62',
          '63',
          '64',
          '65',
          '66',
          '67',
          '68',
          '69',
          '70',
          '71',
          '72',
          '73',
          '74',
          '75',
          '76',
          '77',
          '78',
          '79',
          '80',
          '81',
          '82',
          '83',
          '84',
          '85',
          '86',
          '87',
          '88',
          '89',
          '90',
          '91',
          '92',
          '93',
          '94',
          '95',
          '96',
          '97',
          '98',
          '99',
          '100'
        ]
      >;
    breathiness: Attribute.JSON &
      Attribute.CustomField<
        'plugin::multi-select.multi-select',
        [
          '0',
          '1',
          '2',
          '3',
          '4',
          '5',
          '6',
          '7',
          '8',
          '9',
          '10',
          '11',
          '12',
          '13',
          '14',
          '15',
          '16',
          '17',
          '18',
          '19',
          '20',
          '21',
          '22',
          '23',
          '24',
          '25',
          '26',
          '27',
          '28',
          '29',
          '30',
          '31',
          '32',
          '33',
          '34',
          '35',
          '36',
          '37',
          '38',
          '39',
          '40',
          '41',
          '42',
          '43',
          '44',
          '45',
          '46',
          '47',
          '48',
          '49',
          '50',
          '51',
          '52',
          '53',
          '54',
          '55',
          '56',
          '57',
          '58',
          '59',
          '60',
          '61',
          '62',
          '63',
          '64',
          '65',
          '66',
          '67',
          '68',
          '69',
          '70',
          '71',
          '72',
          '73',
          '74',
          '75',
          '76',
          '77',
          '78',
          '79',
          '80',
          '81',
          '82',
          '83',
          '84',
          '85',
          '86',
          '87',
          '88',
          '89',
          '90',
          '91',
          '92',
          '93',
          '94',
          '95',
          '96',
          '97',
          '98',
          '99',
          '100'
        ]
      >;
    identifier: Attribute.String & Attribute.Required;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'general.resultados': GeneralResultados;
      'general.resultado-do-audio': GeneralResultadoDoAudio;
      'general.audio': GeneralAudio;
    }
  }
}
