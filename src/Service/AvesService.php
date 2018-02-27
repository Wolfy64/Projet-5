<?php

namespace App\Service;

use Doctrine\ORM\EntityManagerInterface;
use App\Entity\Aves;
use App\Entity\Observation;

class AvesService
{
    private $em;

    public function __construct(EntityManagerInterface $em)
    {
        $this->em = $em;
    }

    public function addAves(Observation $observation) : Observation
    {
        $aveses = $this->findBy($observation->getCommonName());

        foreach ($aveses as $aves) {
            $observation->addAves($aves);
        }

        return $observation;
    }

    public function findBy(string $commonName) : ? array
    {
        return $this->em->getRepository(Aves::class)->findBy(['commonName' => $commonName]);
    }
}